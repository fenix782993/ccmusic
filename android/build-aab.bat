@echo off
call gradlew.bat bundleRelease
if errorlevel 1 exit /b 1
echo AAB: app\build\outputs\bundle\release\app-release.aab
