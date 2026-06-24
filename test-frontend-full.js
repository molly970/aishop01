const http = require('http');

console.log('正在测试前端服务器...\n');

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

const req = http.request(options, (res) => {
  console.log('前端状态码:', res.statusCode);
  console.log('响应头:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n响应内容（前200字符）:', data.substring(0, 200));
    
    if (res.statusCode === 200 && data.includes('html')) {
      console.log('\n✓ 前端服务器正常运行！');
      console.log('访问地址: http://localhost:5174');
    } else {
      console.log('\n✗ 前端服务器可能未正常运行');
    }
  });
});

req.on('error', (e) => {
  console.error('✗ 无法连接到前端服务器:', e.message);
});

req.end();
