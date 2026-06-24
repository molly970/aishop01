@echo off
chcp 65001 >nul
echo 正在启动AI任务集市服务器...
cd /d %~dp0

echo 启动后端服务器 (端口3000)...
start "Backend" cmd /k "npm run dev:backend"

echo 等待后端启动...
timeout /t 3 /nobreak >nul

echo 启动前端服务器 (端口5173)...
start "Frontend" cmd /k "npm run dev:frontend"

echo.
echo 服务器已启动！
echo 后端: http://localhost:3000
echo 前端: http://localhost:5173
pause
