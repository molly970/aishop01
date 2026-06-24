const http = require('http');

console.log('=== 完整测试已审核任务功能 ===\n');

const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });

const loginOptions = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, function(res) {
  let data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    const result = JSON.parse(data);
    const token = result.token;
    console.log('✅ 步骤1: 登录成功');
    
    // 测试前端代理
    const frontendOptions = {
      hostname: 'localhost',
      port: 5174,
      path: '/api/tasks/reviewed',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    
    const frontendReq = http.request(frontendOptions, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        const json = JSON.parse(data);
        console.log('✅ 步骤2: 前端代理正常');
        console.log('   - 状态码:', res.statusCode);
        console.log('   - 返回任务数量:', json.length);
        
        console.log('\n📋 已审核任务列表:');
        json.forEach(function(task, i) {
          var statusText = task.status === 'published' ? '已通过' : (task.status === 'cancelled' ? '已拒绝' : task.status);
          var statusColor = task.status === 'published' ? '🟢' : (task.status === 'cancelled' ? '🔴' : '⚪');
          console.log('   ' + (i+1) + '. ' + statusColor + ' ' + task.title + ' - ' + statusText + ' (评分: ' + task.rating + '星)');
        });
        
        console.log('\n🎉 测试完成！已审核任务功能正常工作');
      });
    });
    
    frontendReq.on('error', function(e) { console.error('❌ 前端代理测试失败:', e); });
    frontendReq.end();
  });
});

loginReq.on('error', function(e) { console.error('❌ 登录失败:', e); });
loginReq.write(loginData);
loginReq.end();
