Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "D:\aishop\start-backend.ps1" -Wait:$false -WindowStyle Normal
