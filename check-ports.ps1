Get-NetTCPConnection -LocalPort 5173, 5174, 5175, 3000 -ErrorAction SilentlyContinue | Format-Table LocalAddress, LocalPort, OwningProcess -AutoSize

Write-Host "`n检查Node进程:"
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Format-Table Id, ProcessName, Path -AutoSize
