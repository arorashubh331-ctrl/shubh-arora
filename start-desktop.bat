@echo off
title Lucy Windows 11 Desktop Companion
color 0b
echo ========================================================
echo    LUCY - TRUE WINDOWS 11 VOICE ASSISTANT COMPANION
echo ========================================================
echo.
echo Starting Lucy local execution bridge...
powershell -ExecutionPolicy Bypass -File "%~dp0lucy-windows-agent.ps1"
pause
