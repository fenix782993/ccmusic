@echo off
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1
echo APK: app\build\outputs\apk\debug\app-debug.apk
