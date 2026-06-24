@echo off
echo 启动后端服务器...
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "node_modules\ts-node-dev\bin\ts-node-dev.cmd" --respawn --transpile-only api/server.ts
