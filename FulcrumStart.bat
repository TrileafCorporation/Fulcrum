@echo off

echo ========================================

echo  Starting the Fulcrum Application

echo ========================================

echo.
 
:: Check if pm2 is installed and accessible

where pm2 >nul 2>&1

if %errorlevel% neq 0 (

  echo ERROR: PM2 is not installed or not in your PATH.

  echo Please install PM2 with: npm install pm2 -g

  echo.

  pause

  exit /b 1

)
 
echo Attempting to start the Node application using PM2...

pm2 start "C:\Fulcrum\index.main.js"

if %errorlevel% neq 0 (

  echo ERROR: Failed to start the application with PM2.

  echo Please verify the file path and PM2 configuration.

  echo.

  pause

  exit /b 2

)
 
echo.

echo Application started successfully.

echo You can monitor logs by running: pm2 logs

echo.

pause

 
@echo off

echo ========================================

echo  Starting the Fulcrum Application

echo ========================================

echo.
 
:: Check if pm2 is installed and accessible

where pm2 >nul 2>&1

if %errorlevel% neq 0 (

  echo ERROR: PM2 is not installed or not in your PATH.

  echo Please install PM2 with: npm install pm2 -g

  echo.

  pause

  goto :EOF

)
 
echo Attempting to start the Node application using PM2...

pm2 start "C:\Fulcrum\index.main.js"

if %errorlevel% neq 0 (

  echo ERROR: Failed to start the application with PM2.

  echo Please verify the file path and PM2 configuration.

  echo.

  pause

  goto :EOF

)
 
echo.

echo Application started successfully.

echo You can monitor logs by running: pm2 logs

echo.
 
:: Pause so the user can see the output

pause
 
:: Stay in the command window

cmd /k

 