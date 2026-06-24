@echo off
chcp 65001 >nul
echo ========================================
echo AI任务集市 - 快速诊断工具
echo ========================================
echo.

cd /d %~dp0

echo [1/4] 检查后端服务器...
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 后端服务器运行正常
) else (
    echo ✗ 后端服务器未运行
    echo 请先启动: npm run dev:backend
    pause
    exit /b 1
)

echo.
echo [2/4] 检查前端服务器...
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 前端服务器运行正常
) else (
    echo ! 前端服务器可能未运行
    echo 尝试启动前端服务器...
    start cmd /k "npm run dev:frontend"
)

echo.
echo [3/4] 测试登录API...
curl -s -X POST http://localhost:3000/api/auth/login ^
    -H "Content-Type: application/json" ^
    -d "{\"username\":\"user\",\"password\":\"user123\"}" > temp_login.json

findstr /C:"token" temp_login.json >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 登录API正常
    for /f "tokens=3 delims=," %%a in ('findstr "token" temp_login.json') do set TOKEN=%%a
    set TOKEN=%TOKEN:~1,-2%
) else (
    echo ✗ 登录失败
    del temp_login.json 2>nul
    pause
    exit /b 1
)

echo.
echo [4/4] 测试获取任务列表...
curl -s http://localhost:3000/api/tasks ^
    -H "Authorization: Bearer %TOKEN%" > temp_tasks.json

findstr /C:"published" temp_tasks.json >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 任务API正常，可以获取到任务
    echo.
    echo 正在统计任务数量...
    findstr /C:"published" temp_tasks.json | find /c /v ""
) else (
    echo ! 任务API返回空或格式错误
)

echo.
echo ========================================
echo 诊断完成！
echo ========================================
echo.
echo 建议操作：
echo 1. 打开浏览器访问: http://localhost:5173
echo 2. 登录后访问诊断页面: http://localhost:5173/diagnostics
echo 3. 运行诊断工具查看详细信息
echo.
echo 测试账户:
echo   普通用户: user / user123
echo   管理员: admin / admin123
echo   技术专家: expert / expert123
echo.

del temp_login.json 2>nul
del temp_tasks.json 2>nul

pause
