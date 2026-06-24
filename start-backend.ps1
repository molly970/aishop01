Write-Host "Starting backend server..."
Set-Location "D:\aishop"
& "D:\aishop\node_modules\.bin\tsnd.cmd" --respawn --transpile-only api/server.ts
