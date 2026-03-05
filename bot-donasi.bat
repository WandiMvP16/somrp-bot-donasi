@echo off
title SOMRP Bot Donasi
echo ==========================================
echo    SOMRP BOT DONASI - AUTO STARTER
echo ==========================================
echo.

:: Cek apakah node terinstall
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak terinstall!
    echo Silakan install Node.js dari https://nodejs.org
    pause
    exit /b 1
)

:: Cek apakah folder node_modules ada
if not exist "node_modules" (
    echo [INFO] Menginstall dependencies...
    npm install
    echo.
)

:: Cek apakah .env ada
if not exist ".env" (
    echo [ERROR] File .env tidak ditemukan!
    echo Silakan buat file .env terlebih dahulu.
    pause
    exit /b 1
)

:: Cek apakah qris.png ada
if not exist "assets\qris.png" (
    echo [WARNING] File qris.png tidak ditemukan di folder assets!
    echo Bot tetap akan jalan, tapi command /qris akan error.
    echo.
    pause
)

:: Jalankan bot
echo [INFO] Menjalankan bot...
echo [INFO] Tekan Ctrl+C untuk menghentikan
echo ==========================================
echo.

:loop
node index.js

echo.
echo [WARNING] Bot terhenti! Restart dalam 5 detik...
echo Tekan Ctrl+C untuk keluar, atau tunggu restart otomatis
timeout /t 5 /nobreak >nul
echo [INFO] Restarting...
echo.
goto loop