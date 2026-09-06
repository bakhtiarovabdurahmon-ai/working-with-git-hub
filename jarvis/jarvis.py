"""
jarvis.py
Локальный помощник "Джарвис" — работает и на Windows (ПК), и на Android (через Termux),
БЕЗ изменений в коде. Сам определяет, где запущен, и подбирает нужный способ действия.

Что делает:
- Понимает текстовые и голосовые команды через локальную модель (Ollama), облако (Claude)
  или офлайн-модель на устройстве (llama.cpp)
- Открывает любую установленную программу (Windows: меню "Пуск", Android: список пакетов)
- Скачивает файлы по ссылке
- Создаёт текстовые файлы
- Двигает курсор / кликает (только Windows — на телефоне это не имеет смысла)
- Ищет в Google, если модель не знает ответ
- Кэширует найденное в интернете, забывает то, чем не пользовались 30+ дней
- Слушает голосом и озвучивает ответы (Vosk для распознавания, pyttsx3/термукс-TTS для озвучки) —
  включается переменной окружения JARVIS_VOICE=1, по умолчанию выключено (текстовый режим)

ПК (Windows): python jarvis.py  (или собранный jarvis.exe, см. build_exe.bat)
Телефон (Android): нужен Termux (https://f-droid.org/packages/com.termux/)
  В Termux:
    pkg install python
    pip install requests beautifulsoup4
    python jarvis.py

Голосовой режим (необязательно, см. requirements.txt):
  Windows:
    pip install vosk sounddevice pyttsx3
    скачать модель Vosk (см. VOSK_MODEL_PATH ниже) и распаковать по указанному пути
  Android (Termux):
    установи приложение Termux:API (F-Droid) + pkg install termux-api ffmpeg
    pip install vosk
    скачать модель Vosk и распаковать по указанному пути
  Включить: export JARVIS_VOICE=1 (Termux) / set JARVIS_VOICE=1 (Windows)
"""

import os
import sys
import json
import time
import socket
import sqlite3
import platform
import subprocess

import requests

try:
    import pyautogui
except ImportError:
    pyautogui = None  # недоступно на Android и на системах без экрана

try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from vosk import Model as VoskModel, KaldiRecognizer
except ImportError:
    VoskModel = None
    KaldiRecognizer = None

try:
    import sounddevice as sd
except ImportError:
    sd = None

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None


# ========== ОПРЕДЕЛЕНИЕ ПЛАТФОРМЫ ==========

def get_platform():
    """Возвращает 'windows', 'android' или 'other'."""
    system = platform.system()

    if system == "Windows":
        return "windows"

    # Termux на Android технически определяется как Linux,
    # поэтому проверяем характерный для Termux путь
    if "com.termux" in os.environ.get("PREFIX", ""):
        return "android"

    return "other"


PLATFORM = get_platform()


# ========== НАСТРОЙКИ ==========

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5:7b"  # если будет медленно — поменяй на qwen2.5:3b

# Облачный API (Anthropic) — нужен для телефона (там Ollama не завести) и как
# более умный и многоязычный вариант вообще везде, где есть интернет.
# Ключ НЕ хранится в коде — задай переменную окружения перед запуском:
#   Termux (Android):  export ANTHROPIC_API_KEY="sk-ant-..."
#   Windows (cmd):      set ANTHROPIC_API_KEY=sk-ant-...
#   Windows (PowerShell): $env:ANTHROPIC_API_KEY="sk-ant-..."
# Получить ключ: https://console.anthropic.com/settings/keys (нужно привязать оплату)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
CLOUD_MODEL = "claude-haiku-4-5-20251001"  # быстрая и дешёвая модель — то, что нужно для команд

# Полностью бесплатный офлайн-вариант для телефона — маленькая модель через llama.cpp.
# Работает без интернета и без API-ключа, но слабее и медленнее облака.
# Установка (в Termux): pkg install clang cmake git; pip install llama-cpp-python
# Модель скачать так:
#   mkdir -p ~/models
#   wget -O ~/models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
#     https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf
LLAMACPP_MODEL_PATH = os.path.join(os.environ.get("HOME", ""), "models", "qwen2.5-1.5b-instruct-q4_k_m.gguf")
_llamacpp_instance = None  # модель грузится в память один раз, лениво


class BrainUnavailable(Exception):
    """Означает: этот 'мозг' сейчас недоступен, нужно пробовать следующий по цепочке."""
    pass


class VoiceUnavailable(Exception):
    """Означает: голосовой ввод/вывод сейчас недоступен — используем текст вместо него."""
    pass


DB_PATH = "jarvis_cache.db"
TTL_DAYS = 30

START_MENU_PATHS = [
    os.path.join(os.environ.get("ProgramData", ""), "Microsoft", "Windows", "Start Menu", "Programs"),
    os.path.join(os.environ.get("AppData", ""), "Microsoft", "Windows", "Start Menu", "Programs"),
]

# На Android 11+ обычная программа (без root/adb) не может получить полный список
# установленных приложений через 'pm list packages' — это ограничение приватности
# системы (package visibility), а не баг. Поэтому держим список популярных
# приложений вручную — дополняй его своими нужными программами.
KNOWN_ANDROID_APPS = {
    "whatsapp": "com.whatsapp",
    "ватсап": "com.whatsapp",
    "chrome": "com.android.chrome",
    "хром": "com.android.chrome",
    "телеграм": "org.telegram.messenger",
    "telegram": "org.telegram.messenger",
    "youtube": "com.google.android.youtube",
    "ютуб": "com.google.android.youtube",
    "gmail": "com.google.android.gm",
    "почта": "com.google.android.gm",
    "камера": "com.android.camera",
    "camera": "com.android.camera",
    "настройки": "com.android.settings",
    "settings": "com.android.settings",
    "инстаграм": "com.instagram.android",
    "instagram": "com.instagram.android",
    "карты": "com.google.android.apps.maps",
    "maps": "com.google.android.apps.maps",
}

SYSTEM_PROMPT = """Ты — локальный помощник по имени Джарвис.
Ты понимаешь команды на русском, узбекском и киргизском языках.
Отвечай на том же языке, на котором написана команда пользователя.
Отвечай ТОЛЬКО в формате JSON, без лишнего текста.

Доступные действия:
- {{"action": "open_app", "target": "название программы"}}
- {{"action": "move_cursor", "x": число, "y": число}}
- {{"action": "click"}}
- {{"action": "search", "query": "что искать в интернете"}}
- {{"action": "download", "url": "ссылка на файл", "filename": "имя файла"}}
- {{"action": "create_file", "filename": "имя файла", "content": "содержимое файла"}}
- {{"action": "answer", "text": "обычный текстовый ответ"}}

Если не знаешь ответ на вопрос или это требует свежей информации — используй "search".
Если это обычная беседа или ты знаешь ответ — используй "answer".

Список установленных программ (используй эти названия для open_app):
{app_list}

Команда пользователя: {user_command}
"""


# ========== КЭШ (SQLite) ==========

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS knowledge (
            query TEXT PRIMARY KEY,
            answer TEXT,
            created_at REAL,
            last_used REAL
        )
    """)
    return conn


def cache_get(query):
    conn = get_connection()
    row = conn.execute("SELECT answer FROM knowledge WHERE query = ?", (query,)).fetchone()
    if row:
        conn.execute("UPDATE knowledge SET last_used = ? WHERE query = ?", (time.time(), query))
        conn.commit()
        conn.close()
        return row[0]
    conn.close()
    return None


def cache_save(query, answer):
    conn = get_connection()
    now = time.time()
    conn.execute(
        "INSERT OR REPLACE INTO knowledge (query, answer, created_at, last_used) VALUES (?, ?, ?, ?)",
        (query, answer, now, now)
    )
    conn.commit()
    conn.close()


def cache_cleanup():
    conn = get_connection()
    cutoff = time.time() - TTL_DAYS * 86400
    conn.execute("DELETE FROM knowledge WHERE last_used < ?", (cutoff,))
    conn.commit()
    conn.close()


# ========== СПИСОК ПРОГРАММ (Windows и Android) ==========

def get_installed_apps():
    """Возвращает словарь {название: идентификатор}.
    На Windows идентификатор — путь к ярлыку.
    На Android — имя пакета (например, com.google.android.gm)."""

    if PLATFORM == "windows":
        apps = {}
        for base_path in START_MENU_PATHS:
            if not base_path or not os.path.exists(base_path):
                continue
            for root, _, files in os.walk(base_path):
                for file in files:
                    if file.lower().endswith(".lnk"):
                        name = file[:-4]
                        apps[name.lower()] = os.path.join(root, file)
        return apps

    if PLATFORM == "android":
        apps = dict(KNOWN_ANDROID_APPS)  # начинаем с проверенного списка

        try:
            # Пробуем динамический список — сработает только на Android до 11
            # или если у Termux вручную выдано разрешение QUERY_ALL_PACKAGES
            result = subprocess.run(
                ["pm", "list", "packages"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                for line in result.stdout.splitlines():
                    if line.startswith("package:"):
                        package_name = line.replace("package:", "").strip()
                        short_name = package_name.split(".")[-1]
                        apps[short_name.lower()] = package_name
            # если код не 0 — молча используем KNOWN_ANDROID_APPS, это ожидаемо
            # на Android 11+ без root (ограничение package visibility)
        except Exception:
            pass  # тот же случай — остаёмся на встроенном списке

        return apps

    return {}


def find_app_path(app_name, apps):
    app_name = app_name.lower()
    if app_name in apps:
        return apps[app_name]
    for name, identifier in apps.items():
        if app_name in name:
            return identifier
    return None


# ========== ПОИСК В GOOGLE (общий для обеих платформ) ==========

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def search_google(query, num_results=3):
    cached = cache_get(query)
    if cached:
        return cached

    if BeautifulSoup is None:
        return "Модуль beautifulsoup4 не установлен — поиск недоступен."

    url = f"https://www.google.com/search?q={requests.utils.quote(query)}"
    response = requests.get(url, headers=HEADERS, timeout=10)
    soup = BeautifulSoup(response.text, "html.parser")

    snippets = [b.get_text() for b in soup.select("div.BNeawe.s3v9rd.AP7Wnd")[:num_results] if b.get_text()]

    if not snippets:
        return "Не удалось найти ответ в интернете."

    result_text = " | ".join(snippets)
    cache_save(query, result_text)
    return result_text


# ========== МОЗГ (Ollama) ==========

def ask_local_ollama_model(user_command, app_names):
    prompt = SYSTEM_PROMPT.format(
        app_list=", ".join(app_names[:50]),
        user_command=user_command
    )

    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=60)
    except requests.exceptions.ConnectionError:
        raise BrainUnavailable("Ollama недоступна (localhost:11434 не отвечает)")
    except requests.exceptions.RequestException as e:
        raise BrainUnavailable(f"ошибка запроса к Ollama: {e}")

    raw_text = response.json().get("response", "{}")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return {"action": "answer", "text": raw_text}


def ask_cloud_model(user_command, app_names):
    """Отправляет команду в облачный API Anthropic (Claude) вместо локальной модели."""

    if not ANTHROPIC_API_KEY:
        raise BrainUnavailable("не задан ANTHROPIC_API_KEY")

    prompt = SYSTEM_PROMPT.format(
        app_list=", ".join(app_names[:50]),
        user_command=user_command
    )

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": CLOUD_MODEL,
        "max_tokens": 300,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        response = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=30)
    except requests.exceptions.ConnectionError:
        raise BrainUnavailable("нет связи с облачным API")
    except requests.exceptions.RequestException as e:
        raise BrainUnavailable(f"ошибка запроса к облачному API: {e}")

    if response.status_code != 200:
        raise BrainUnavailable(f"облако вернуло ошибку {response.status_code}")

    data = response.json()
    raw_text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return {"action": "answer", "text": raw_text}


def get_llamacpp_instance():
    """Загружает модель llama.cpp в память один раз (лениво) и переиспользует."""
    global _llamacpp_instance

    if _llamacpp_instance is not None:
        return _llamacpp_instance

    if Llama is None:
        raise BrainUnavailable("библиотека llama-cpp-python не установлена")

    if not os.path.exists(LLAMACPP_MODEL_PATH):
        raise BrainUnavailable(f"не найден файл модели: {LLAMACPP_MODEL_PATH}")

    _llamacpp_instance = Llama(model_path=LLAMACPP_MODEL_PATH, n_ctx=2048, verbose=False)
    return _llamacpp_instance


def ask_llamacpp_model(user_command, app_names):
    """Полностью бесплатный офлайн-вариант — маленькая модель прямо на устройстве."""
    llm = get_llamacpp_instance()  # выбросит BrainUnavailable, если модели нет

    prompt = SYSTEM_PROMPT.format(
        app_list=", ".join(app_names[:50]),
        user_command=user_command
    )

    try:
        output = llm(prompt, max_tokens=200, stop=["\n\n"])
    except Exception as e:
        raise BrainUnavailable(f"ошибка генерации llama.cpp: {e}")

    raw_text = output["choices"][0]["text"].strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return {"action": "answer", "text": raw_text}


def ask_model(user_command, app_names, online):
    """
    Пробует 'мозги' по очереди, пока один не сработает:
    1. Облачный API (если есть ключ и интернет) — самый умный и многоязычный
    2. Ollama на ПК (если запущена)
    3. llama.cpp прямо на устройстве (бесплатно, офлайн, но слабее)
    Если не сработал ни один — честно говорит, почему.
    """
    errors = []

    if ANTHROPIC_API_KEY and online:
        try:
            return ask_cloud_model(user_command, app_names)
        except BrainUnavailable as e:
            errors.append(f"облако: {e}")

    try:
        return ask_local_ollama_model(user_command, app_names)
    except BrainUnavailable as e:
        errors.append(f"Ollama: {e}")

    try:
        return ask_llamacpp_model(user_command, app_names)
    except BrainUnavailable as e:
        errors.append(f"llama.cpp: {e}")

    return {
        "action": "answer",
        "text": "Не могу обработать команду — ни один 'мозг' не доступен. Причины: " + "; ".join(errors)
    }


# ========== ГОЛОС (ввод/вывод) ==========
# Выключено по умолчанию (текстовый режим) — включается переменной окружения JARVIS_VOICE=1.
# По умолчанию выключено, потому что: (а) не ломает уже работающий текстовый режим и тесты,
# (б) на телефоне ещё не проверено на реальном устройстве (см. VOICE_RECORD_SECONDS ниже).
VOICE_ENABLED = os.environ.get("JARVIS_VOICE", "0") == "1"

# Модель Vosk для офлайн-распознавания речи. Скачать (пример — маленькая русская модель):
#   mkdir -p ~/models
#   wget -O /tmp/vosk-model.zip https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip
#   unzip /tmp/vosk-model.zip -d ~/models
#   mv ~/models/vosk-model-small-ru-0.22 ~/models/vosk-ru
# Другие языки (узбекский/киргизский) официальных моделей Vosk на момент написания нет —
# для них распознавание речи придётся делать через облако (не реализовано).
VOSK_MODEL_PATH = os.path.join(os.environ.get("HOME", ""), "models", "vosk-ru")
VOICE_SAMPLE_RATE = 16000
VOICE_RECORD_SECONDS = 5

_vosk_model_instance = None   # модель Vosk грузится в память один раз, лениво
_tts_engine_instance = None   # движок pyttsx3 (только Windows) — тоже лениво


def get_vosk_model():
    """Загружает модель Vosk один раз и переиспользует. Бросает VoiceUnavailable, если не готова."""
    global _vosk_model_instance

    if _vosk_model_instance is not None:
        return _vosk_model_instance

    if VoskModel is None:
        raise VoiceUnavailable("библиотека vosk не установлена (pip install vosk)")

    if not os.path.isdir(VOSK_MODEL_PATH):
        raise VoiceUnavailable(f"не найдена модель Vosk по пути: {VOSK_MODEL_PATH}")

    _vosk_model_instance = VoskModel(VOSK_MODEL_PATH)
    return _vosk_model_instance


def record_audio_windows(seconds=VOICE_RECORD_SECONDS):
    """Записывает звук с микрофона на ПК через sounddevice (готовые колёса, компилировать не надо)."""
    if sd is None:
        raise VoiceUnavailable("библиотека sounddevice не установлена (pip install sounddevice)")

    try:
        audio = sd.rec(int(seconds * VOICE_SAMPLE_RATE), samplerate=VOICE_SAMPLE_RATE,
                        channels=1, dtype="int16")
        sd.wait()
    except Exception as e:
        raise VoiceUnavailable(f"не удалось записать звук с микрофона: {e}")

    return audio.tobytes()


def record_audio_android(seconds=VOICE_RECORD_SECONDS):
    """
    Записывает звук на телефоне через Termux:API (termux-microphone-record).
    sounddevice/portaudio почти невозможно собрать в Termux без root, поэтому запись
    идёт через приложение Termux:API, а результат конвертируется в PCM WAV через ffmpeg,
    т.к. Vosk понимает только "сырой" PCM.
    Нужно: приложение Termux:API (F-Droid) + `pkg install termux-api ffmpeg`.
    """
    tmp_dir = os.environ.get("TMPDIR", "/tmp")
    tmp_raw = os.path.join(tmp_dir, "jarvis_rec.m4a")
    tmp_wav = os.path.join(tmp_dir, "jarvis_rec.wav")

    try:
        subprocess.run(["termux-microphone-record", "-f", tmp_raw, "-l", str(seconds)],
                        check=True, timeout=seconds + 5)
    except FileNotFoundError:
        raise VoiceUnavailable("termux-microphone-record не найден — установи pkg install termux-api "
                                "и приложение Termux:API")
    except Exception as e:
        raise VoiceUnavailable(f"не удалось записать звук: {e}")

    time.sleep(seconds + 0.5)  # запись идёт в фоне, ждём её завершения

    try:
        subprocess.run(["ffmpeg", "-y", "-i", tmp_raw, "-ar", str(VOICE_SAMPLE_RATE), "-ac", "1",
                         "-f", "wav", tmp_wav], check=True, capture_output=True, timeout=15)
    except FileNotFoundError:
        raise VoiceUnavailable("ffmpeg не установлен — выполни: pkg install ffmpeg")
    except Exception as e:
        raise VoiceUnavailable(f"не удалось конвертировать запись: {e}")

    with open(tmp_wav, "rb") as f:
        wav_bytes = f.read()

    return wav_bytes[44:]  # первые 44 байта — заголовок WAV, Vosk нужны только сами PCM-данные


def listen():
    """
    Слушает микрофон и возвращает распознанный текст.
    Если что-то недоступно (нет модели/микрофона/библиотеки) — бросает VoiceUnavailable,
    и main() сам предложит ввести команду текстом (тот же принцип, что и в ask_model).
    """
    model = get_vosk_model()  # бросит VoiceUnavailable, если Vosk не настроен

    print(f"Джарвис слушает {VOICE_RECORD_SECONDS} сек...")
    if PLATFORM == "windows":
        audio_bytes = record_audio_windows()
    elif PLATFORM == "android":
        audio_bytes = record_audio_android()
    else:
        raise VoiceUnavailable("голосовой ввод не реализован для этой платформы")

    recognizer = KaldiRecognizer(model, VOICE_SAMPLE_RATE)
    recognizer.AcceptWaveform(audio_bytes)
    result = json.loads(recognizer.FinalResult())
    text = result.get("text", "").strip()

    if not text:
        raise VoiceUnavailable("не удалось распознать речь")
    return text


def get_tts_engine():
    """Windows: голосовой движок pyttsx3 (озвучка через SAPI5), грузится один раз."""
    global _tts_engine_instance

    if _tts_engine_instance is not None:
        return _tts_engine_instance

    if pyttsx3 is None:
        raise VoiceUnavailable("библиотека pyttsx3 не установлена (pip install pyttsx3)")

    _tts_engine_instance = pyttsx3.init()
    return _tts_engine_instance


def speak(text):
    """
    Озвучивает ответ.
    Windows — pyttsx3 (SAPI5, встроен в систему, ничего скачивать не надо).
    Android — родной TTS-движок телефона через Termux:API (termux-tts-speak):
    pyttsx3 на Android без espeak не работает, а termux-tts-speak использует
    уже установленный на телефоне голосовой движок — надёжнее и не требует компиляции.
    Если озвучка недоступна — просто ничего не делает (текст уже напечатан на экране).
    """
    if not VOICE_ENABLED or not text:
        return

    try:
        if PLATFORM == "windows":
            engine = get_tts_engine()
            engine.say(text)
            engine.runAndWait()
        elif PLATFORM == "android":
            subprocess.run(["termux-tts-speak", text], timeout=15)
    except Exception as e:
        print(f"(озвучка недоступна: {e})")


# ========== ДЕЙСТВИЯ ==========

def get_downloads_folder():
    """Папка для скачанных файлов — своя для каждой платформы."""
    if PLATFORM == "windows":
        return os.path.join(os.path.expanduser("~"), "Downloads")

    if PLATFORM == "android":
        # Работает, только если пользователь один раз выполнил в Termux: termux-setup-storage
        shared = os.path.join(os.environ.get("HOME", ""), "storage", "downloads")
        if os.path.exists(shared):
            return shared
        return os.getcwd()

    return os.getcwd()


def action_open_app(app_name, apps):
    identifier = find_app_path(app_name, apps)
    if not identifier:
        return f"Не нашёл программу '{app_name}'."

    if PLATFORM == "windows":
        os.startfile(identifier)
        return f"Открываю {app_name}"

    if PLATFORM == "android":
        try:
            subprocess.run([
                "am", "start", "-a", "android.intent.action.MAIN",
                "-c", "android.intent.category.LAUNCHER",
                "-p", identifier
            ], check=True, timeout=10)
            return f"Открываю {app_name}"
        except Exception as e:
            return f"Не удалось открыть {app_name}: {e}"

    return "Открытие приложений не поддерживается на этой платформе."


def action_move_cursor(x, y):
    if pyautogui is None:
        return "Управление курсором недоступно на этой платформе (только ПК)."
    pyautogui.moveTo(x, y, duration=0.3)
    return f"Двигаю курсор в ({x}, {y})"


def action_click():
    if pyautogui is None:
        return "Клик недоступен на этой платформе (только ПК)."
    pyautogui.click()
    return "Клик выполнен"


def action_download(url, filename=None):
    if not filename:
        filename = url.split("/")[-1] or "downloaded_file"

    folder = get_downloads_folder()
    os.makedirs(folder, exist_ok=True)
    full_path = os.path.join(folder, filename)

    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        with open(full_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return f"Скачал файл: {full_path}"
    except Exception as e:
        return f"Не удалось скачать файл: {e}"


def action_create_file(filename, content=""):
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Создал файл: {os.path.abspath(filename)}"
    except Exception as e:
        return f"Не удалось создать файл: {e}"


def run_action(action_dict, apps):
    action = action_dict.get("action")

    if action == "open_app":
        return action_open_app(action_dict.get("target", ""), apps)
    elif action == "move_cursor":
        return action_move_cursor(action_dict.get("x", 0), action_dict.get("y", 0))
    elif action == "click":
        return action_click()
    elif action == "search":
        return search_google(action_dict.get("query", ""))
    elif action == "download":
        return action_download(action_dict.get("url", ""), action_dict.get("filename"))
    elif action == "create_file":
        return action_create_file(action_dict.get("filename", "новый_файл.txt"), action_dict.get("content", ""))
    elif action == "answer":
        return action_dict.get("text", "")
    else:
        return f"Неизвестное действие: {action}"


# ========== ГЛАВНЫЙ ЦИКЛ ==========

def has_internet():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=2)
        return True
    except OSError:
        return False


def get_user_command():
    """Получает команду от пользователя: голосом (если включено и доступно) или текстом."""
    if VOICE_ENABLED:
        try:
            text = listen()
            print("Ты (голосом):", text)
            return text
        except VoiceUnavailable as e:
            print(f"(голосовой ввод недоступен: {e} — печатай текстом)")

    return input("\nТы: ").strip()


def main():
    print(f"Джарвис запущен на платформе: {PLATFORM}")
    print("Пиши команды (или 'выход' для остановки).")

    cache_cleanup()

    apps = get_installed_apps()
    app_names = list(apps.keys())
    print(f"Найдено установленных программ: {len(app_names)}")

    online = has_internet()
    print("Режим:", "онлайн" if online else "офлайн")
    if ANTHROPIC_API_KEY and online:
        print("Мозг: облачный API (Claude), запасной — Ollama, затем llama.cpp")
    else:
        print("Мозг: Ollama (если запущена), запасной — llama.cpp на устройстве")
    print("Голос:", "включен (JARVIS_VOICE=1)" if VOICE_ENABLED else "выключен (задай JARVIS_VOICE=1, чтобы включить)")

    while True:
        user_input = get_user_command()

        if user_input.lower() in ("выход", "exit", "quit"):
            print("Джарвис: Пока!")
            speak("Пока!")
            break

        action_dict = ask_model(user_input, app_names, online)

        if action_dict.get("action") in ("search", "download") and not online:
            message = "Нет интернета, не могу это сделать сейчас."
            print("Джарвис:", message)
            speak(message)
            continue

        result = run_action(action_dict, apps)
        print("Джарвис:", result)
        speak(result)


if __name__ == "__main__":
    main()
