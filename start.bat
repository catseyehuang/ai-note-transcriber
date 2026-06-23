@echo off
title AI Study Notes Assistant Server
echo Starting local web server...
powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
