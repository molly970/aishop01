const http = require('http');

const postData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const loginResult = JSON.parse(data);
    console.log('登录成功:', loginResult.user.username);
    
    // 测试待审核任务API
    testAPI('/api/tasks/pending', loginResult.token, '待审核任务');
    
    // 测试已审核任务API
    setTimeout(() => {
      testAPI('/api/tasks/reviewed', loginResult.token, '已审核任务');
    }, 500);
  });
});

function testAPI(path, token, name) {
  const options = {
    hostname: 'localhost',
    port: 3003,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('\n=== ' + name + ' API 测试 ===');
      console.log('状态码:', res.statusCode);
      try {
        const result = JSON.parse(data);
        console.log('数据类型:', typeof result);
        console.log('是否数组:', Array.isArray(result));
        console.log('数据长度:', result.length);
        if (result.length > 0) {
          console.log('前3条数据:');
          result.slice(0, 3).forEach(function(item, i) {
            console.log((i+1) + '. ID: ' + item.id + ', 标题: ' + item.title + ', 状态: ' + item.status);
          });
        }
      } catch (e) {
        console.log('响应内容:', data);
      }
    });
  });
  
  req.on('error', function(e) {
    console.error(name + '请求错误:', e);
  });
  
  req.end();
}

req.on('error', function(e) {
  console.error('登录请求错误:', e);
});

req.write(postData);
req.end();
