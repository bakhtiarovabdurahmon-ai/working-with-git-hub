@echo off
REM Сборка jarvis.py в один exe-файл для Windows через PyInstaller.
REM Запускать на настоящей Windows-машине (НЕ в Termux) из папки jarvis\.

python -m pip install --upgrade pyinstaller
python -m pip install -r requirements.txt

REM --onefile: всё упаковывается в один jarvis.exe
REM --name: как будет называться готовый файл
pyinstaller --onefile --name jarvis --console jarvis.py

if exist dist\jarvis.exe (
    echo.
    echo Готово! Файл: dist\jarvis.exe
) else (
    echo.
    echo Сборка не завершилась — смотри ошибки выше.
)

pause
