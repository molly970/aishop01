const http = require('http');

const postData = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const loginResult = JSON.parse(data);
    console.log('登录结果:', loginResult);
    
    if (loginResult.token) {
      const token = loginResult.token;
      
      // 测试 reviewed API
      const getOptions = {
        hostname: 'localhost',
        port: 3003,
        path: '/api/tasks/reviewed',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      };
      
      const getReq = http.request(getOptions, (getRes) => {
        let getData = '';
        getRes.on('data', (chunk) => {
          getData += chunk;
        });
        getRes.on('end', () => {
          console.log('\n=== /api/tasks/reviewed 响应 ===');
          try {
            const result = JSON.parse(getData);
            console.log('数据类型:', typeof result);
            console.log('是否数组:', Array.isArray(result));
            console.log('数据长度:', result.length);
            console.log('\n返回数据:');
            console.log(JSON.stringify(result, null, 2));
          } catch (e) {
            console.log('响应内容:', getData);
          }
        });
      });
      
      getReq.on('error', (e) => {
        console.error('请求错误:', e);
      });
      
      getReq.end();
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e);
});

req.write(postData);
req.end();
