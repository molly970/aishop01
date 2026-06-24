const http = require('http');

console.log('正在测试前端服务器...\n');

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('前端状态码:', res.statusCode);
  
  if (res.statusCode === 200) {
    console.log('✓ 前端服务器正常运行！');
    console.log('访问地址: http://localhost:5174');
  } else {
    console.log('✗ 前端服务器异常');
  }
});

req.on('error', (e) => {
  console.error('✗ 无法连接到前端服务器:', e.message);
});

req.end();
