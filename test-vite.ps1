$response = Invoke-WebRequest -Uri "http://localhost:5175" -UserAgent "Mozilla/5.0" -TimeoutSec 5 -ErrorAction SilentlyContinue

if ($response) {
    Write-Host "状态码: $($response.StatusCode)"
    Write-Host "响应内容（前200字符）: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))"
    
    if ($response.StatusCode -eq 200) {
        Write-Host "`n✓ 前端服务器正常运行！"
        Write-Host "访问地址: http://localhost:5175"
    }
} else {
    Write-Host "✗ 无法连接到前端服务器"
}
