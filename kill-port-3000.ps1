Write-Host "检查端口 3000..."
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    Write-Host "找到占用端口 3000 的进程:"
    $connections | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  PID: $($process.Id) - $($process.ProcessName)"
            Write-Host "    停止进程..."
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Write-Host "    进程已停止"
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "端口 3000 未被占用"
}
Write-Host "完成"
