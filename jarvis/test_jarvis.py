"""
Юнит-тесты для jarvis.py — без реального Android/Ollama/Anthropic ключа/микрофона,
всё внешнее (сеть, subprocess, файлы моделей) подменяется моками.

Запуск:  python -m unittest test_jarvis -v
"""

import os
import sys
import json
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jarvis


class TestPlatformDetection(unittest.TestCase):

    @mock.patch("jarvis.platform.system", return_value="Windows")
    def test_windows(self, _):
        self.assertEqual(jarvis.get_platform(), "windows")

    @mock.patch.dict(os.environ, {"PREFIX": "/data/data/com.termux/files/usr"})
    @mock.patch("jarvis.platform.system", return_value="Linux")
    def test_android_termux(self, _):
        self.assertEqual(jarvis.get_platform(), "android")

    @mock.patch.dict(os.environ, {"PREFIX": ""}, clear=False)
    @mock.patch("jarvis.platform.system", return_value="Linux")
    def test_other_linux(self, _):
        self.assertEqual(jarvis.get_platform(), "other")


class TestCache(unittest.TestCase):

    def setUp(self):
        self.db_path = os.path.join(os.path.dirname(__file__), "test_cache.db")
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        self._orig_db_path = jarvis.DB_PATH
        jarvis.DB_PATH = self.db_path

    def tearDown(self):
        jarvis.DB_PATH = self._orig_db_path
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_get_missing_returns_none(self):
        self.assertIsNone(jarvis.cache_get("нет такого запроса"))

    def test_save_then_get(self):
        jarvis.cache_save("столица франции", "Париж")
        self.assertEqual(jarvis.cache_get("столица франции"), "Париж")

    def test_cleanup_removes_old_entries(self):
        jarvis.cache_save("старый запрос", "ответ")
        conn = jarvis.get_connection()
        old_time = jarvis.time.time() - (jarvis.TTL_DAYS + 1) * 86400
        conn.execute("UPDATE knowledge SET last_used = ? WHERE query = ?", (old_time, "старый запрос"))
        conn.commit()
        conn.close()

        jarvis.cache_cleanup()
        self.assertIsNone(jarvis.cache_get("старый запрос"))

    def test_cleanup_keeps_recent_entries(self):
        jarvis.cache_save("свежий запрос", "ответ")
        jarvis.cache_cleanup()
        self.assertEqual(jarvis.cache_get("свежий запрос"), "ответ")


class TestAskModelChain(unittest.TestCase):
    """Проверяем цепочку 'мозгов': облако -> Ollama -> llama.cpp -> честная ошибка."""

    def test_cloud_used_when_available_and_online(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", "fake-key"), \
             mock.patch("jarvis.ask_cloud_model", return_value={"action": "answer", "text": "из облака"}) as cloud, \
             mock.patch("jarvis.ask_local_ollama_model") as ollama:
            result = jarvis.ask_model("привет", [], online=True)
            self.assertEqual(result["text"], "из облака")
            cloud.assert_called_once()
            ollama.assert_not_called()

    def test_falls_back_to_ollama_when_cloud_unavailable(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", "fake-key"), \
             mock.patch("jarvis.ask_cloud_model", side_effect=jarvis.BrainUnavailable("нет ключа")), \
             mock.patch("jarvis.ask_local_ollama_model", return_value={"action": "answer", "text": "из ollama"}):
            result = jarvis.ask_model("привет", [], online=True)
            self.assertEqual(result["text"], "из ollama")

    def test_falls_back_to_llamacpp_when_cloud_and_ollama_unavailable(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", ""), \
             mock.patch("jarvis.ask_local_ollama_model", side_effect=jarvis.BrainUnavailable("не запущена")), \
             mock.patch("jarvis.ask_llamacpp_model", return_value={"action": "answer", "text": "из llama.cpp"}):
            result = jarvis.ask_model("привет", [], online=False)
            self.assertEqual(result["text"], "из llama.cpp")

    def test_no_brain_available_reports_all_reasons(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", "fake-key"), \
             mock.patch("jarvis.ask_cloud_model", side_effect=jarvis.BrainUnavailable("облако лежит")), \
             mock.patch("jarvis.ask_local_ollama_model", side_effect=jarvis.BrainUnavailable("ollama не запущена")), \
             mock.patch("jarvis.ask_llamacpp_model", side_effect=jarvis.BrainUnavailable("нет модели")):
            result = jarvis.ask_model("привет", [], online=True)
            self.assertEqual(result["action"], "answer")
            self.assertIn("облако лежит", result["text"])
            self.assertIn("ollama не запущена", result["text"])
            self.assertIn("нет модели", result["text"])

    def test_no_cloud_attempt_when_offline(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", "fake-key"), \
             mock.patch("jarvis.ask_cloud_model") as cloud, \
             mock.patch("jarvis.ask_local_ollama_model", return_value={"action": "answer", "text": "ollama"}):
            jarvis.ask_model("привет", [], online=False)
            cloud.assert_not_called()

    def test_ollama_invalid_json_becomes_plain_answer(self):
        fake_response = mock.Mock()
        fake_response.json.return_value = {"response": "не json, просто текст"}
        with mock.patch("jarvis.requests.post", return_value=fake_response):
            result = jarvis.ask_local_ollama_model("привет", [])
            self.assertEqual(result, {"action": "answer", "text": "не json, просто текст"})

    def test_ollama_connection_error_raises_brain_unavailable(self):
        with mock.patch("jarvis.requests.post", side_effect=jarvis.requests.exceptions.ConnectionError()):
            with self.assertRaises(jarvis.BrainUnavailable):
                jarvis.ask_local_ollama_model("привет", [])

    def test_cloud_missing_key_raises_immediately(self):
        with mock.patch("jarvis.ANTHROPIC_API_KEY", ""):
            with self.assertRaises(jarvis.BrainUnavailable):
                jarvis.ask_cloud_model("привет", [])

    def test_cloud_bad_status_raises_brain_unavailable(self):
        fake_response = mock.Mock(status_code=500)
        with mock.patch("jarvis.ANTHROPIC_API_KEY", "fake-key"), \
             mock.patch("jarvis.requests.post", return_value=fake_response):
            with self.assertRaises(jarvis.BrainUnavailable):
                jarvis.ask_cloud_model("привет", [])


class TestActions(unittest.TestCase):

    def test_create_file(self):
        path = os.path.join(os.path.dirname(__file__), "test_created.txt")
        try:
            result = jarvis.action_create_file(path, "привет мир")
            self.assertIn("Создал файл", result)
            with open(path, encoding="utf-8") as f:
                self.assertEqual(f.read(), "привет мир")
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_create_file_error(self):
        # Путь с недопустимым для файловой системы именем каталога (несуществующая директория без создания)
        bad_path = "/несуществующая_папка_xyz/файл.txt"
        result = jarvis.action_create_file(bad_path, "текст")
        self.assertIn("Не удалось создать файл", result)

    def test_download_success(self):
        fake_response = mock.Mock()
        fake_response.raise_for_status = mock.Mock()
        fake_response.iter_content = mock.Mock(return_value=[b"data-chunk"])

        folder = os.path.join(os.path.dirname(__file__), "test_downloads")
        try:
            with mock.patch("jarvis.requests.get", return_value=fake_response), \
                 mock.patch("jarvis.get_downloads_folder", return_value=folder):
                result = jarvis.action_download("https://example.com/file.txt")
                self.assertIn("Скачал файл", result)
                full_path = os.path.join(folder, "file.txt")
                self.assertTrue(os.path.exists(full_path))
        finally:
            if os.path.isdir(folder):
                for f in os.listdir(folder):
                    os.remove(os.path.join(folder, f))
                os.rmdir(folder)

    def test_download_error(self):
        with mock.patch("jarvis.requests.get", side_effect=jarvis.requests.exceptions.RequestException("нет сети")):
            result = jarvis.action_download("https://example.com/file.txt")
            self.assertIn("Не удалось скачать файл", result)

    def test_find_app_path_exact_and_partial(self):
        apps = {"chrome": "com.android.chrome", "telegram": "org.telegram.messenger"}
        self.assertEqual(jarvis.find_app_path("chrome", apps), "com.android.chrome")
        self.assertEqual(jarvis.find_app_path("telegr", apps), "org.telegram.messenger")
        self.assertIsNone(jarvis.find_app_path("несуществует", apps))

    def test_run_action_unknown(self):
        result = jarvis.run_action({"action": "полёт_на_луну"}, {})
        self.assertIn("Неизвестное действие", result)

    def test_run_action_answer(self):
        result = jarvis.run_action({"action": "answer", "text": "готово"}, {})
        self.assertEqual(result, "готово")


class TestSearchGoogle(unittest.TestCase):

    def setUp(self):
        self.db_path = os.path.join(os.path.dirname(__file__), "test_search_cache.db")
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        self._orig_db_path = jarvis.DB_PATH
        jarvis.DB_PATH = self.db_path

    def tearDown(self):
        jarvis.DB_PATH = self._orig_db_path
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_returns_cached_result_without_network(self):
        jarvis.cache_save("погода", "солнечно")
        with mock.patch("jarvis.requests.get") as get_mock:
            result = jarvis.search_google("погода")
            self.assertEqual(result, "солнечно")
            get_mock.assert_not_called()

    def test_no_beautifulsoup_installed(self):
        with mock.patch("jarvis.BeautifulSoup", None):
            result = jarvis.search_google("что-то новое")
            self.assertIn("beautifulsoup4 не установлен", result)


class TestVoiceGracefulFallback(unittest.TestCase):
    """Голосовой ввод/вывод должен ЧЕСТНО падать в VoiceUnavailable, а не ронять программу."""

    def setUp(self):
        jarvis._vosk_model_instance = None
        jarvis._tts_engine_instance = None

    def test_vosk_model_missing_library(self):
        with mock.patch("jarvis.VoskModel", None):
            with self.assertRaises(jarvis.VoiceUnavailable):
                jarvis.get_vosk_model()

    def test_vosk_model_missing_files(self):
        with mock.patch("jarvis.VoskModel", mock.Mock()), \
             mock.patch("jarvis.os.path.isdir", return_value=False):
            with self.assertRaises(jarvis.VoiceUnavailable):
                jarvis.get_vosk_model()

    def test_record_audio_windows_missing_sounddevice(self):
        with mock.patch("jarvis.sd", None):
            with self.assertRaises(jarvis.VoiceUnavailable):
                jarvis.record_audio_windows()

    def test_record_audio_android_missing_termux_api(self):
        with mock.patch("jarvis.subprocess.run", side_effect=FileNotFoundError()):
            with self.assertRaises(jarvis.VoiceUnavailable):
                jarvis.record_audio_android()

    def test_tts_engine_missing_library(self):
        with mock.patch("jarvis.pyttsx3", None):
            with self.assertRaises(jarvis.VoiceUnavailable):
                jarvis.get_tts_engine()

    def test_speak_noop_when_voice_disabled(self):
        with mock.patch("jarvis.VOICE_ENABLED", False), \
             mock.patch("jarvis.get_tts_engine") as tts:
            jarvis.speak("привет")
            tts.assert_not_called()

    def test_speak_swallows_errors_when_enabled(self):
        with mock.patch("jarvis.VOICE_ENABLED", True), \
             mock.patch("jarvis.PLATFORM", "windows"), \
             mock.patch("jarvis.get_tts_engine", side_effect=jarvis.VoiceUnavailable("нет pyttsx3")):
            # не должно бросать исключение наружу
            jarvis.speak("привет")

    def test_get_user_command_falls_back_to_text_input(self):
        with mock.patch("jarvis.VOICE_ENABLED", True), \
             mock.patch("jarvis.listen", side_effect=jarvis.VoiceUnavailable("нет микрофона")), \
             mock.patch("builtins.input", return_value="открой хром"):
            result = jarvis.get_user_command()
            self.assertEqual(result, "открой хром")


if __name__ == "__main__":
    unittest.main()
