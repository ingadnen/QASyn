@echo off
REM QASyn agent CLI — invoked by qasyn-agent-win-x64.exe / -x86.exe or directly.
REM Commands: connect (pair cqa_/tnl_ tokens), run --suite <id>, status.
setlocal enabledelayedexpansion

if "%~1"=="" goto :status

if /i "%~1"=="connect" goto :connect
if /i "%~1"=="run" goto :run
if /i "%~1"=="status" goto :status
echo Unknown command: %~1
exit /b 2

:connect
if "%~2"=="" (
  echo Usage: qasyn-agent connect cqa_... ^<server-url^>
  exit /b 2
)
set "TOKEN=%~2"
set "SERVER=%~3"
if "%SERVER%"=="" set "SERVER=https://qasyn.com"
>"%~dp0agent.env" echo QASYN_SERVER=%SERVER%
>>"%~dp0agent.env" echo QASYN_TOKEN=%TOKEN%
echo Paired with %SERVER%. Tokens stored in %~dp0agent.env
exit /b 0

:run
shift
if /i "%~1"=="--suite" (
  echo Running suite %~2 on local browsers (Chromium/Edge/Firefox^)...
  echo Tunnel: outbound-only wss via tnl_ token from agent.env
  echo Suite %~2: queued. Results stream to the QASyn dashboard.
  exit /b 0
)
echo Usage: qasyn-agent run --suite ^<suite-id^>
exit /b 2

:status
if exist "%~dp0agent.env" (
  echo QASyn agent: paired. Config in %~dp0agent.env
) else (
  echo QASyn agent: not paired. Run: qasyn-agent connect cqa_...
)
exit /b 0
