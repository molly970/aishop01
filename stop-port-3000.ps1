$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping PID: $($process.Id) - $($process.ProcessName)"
            Stop-Process -Id $process.Id -Force
        }
    }
    Write-Host "Done"
} else {
    Write-Host "Port 3000 is free"
}
