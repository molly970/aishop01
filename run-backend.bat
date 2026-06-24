@echo off
cd /d d:\aishop
D:\aishop\node_modules\.bin\tsnd.cmd --respawn --transpile-only api/server.ts
pause
