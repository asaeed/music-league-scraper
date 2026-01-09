@echo off
setlocal

where node >NUL 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Please install from https://nodejs.org/
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Running scraper...
node ml-scraper.js
