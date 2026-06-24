const http = require('http');

let token = '';

// 步骤1：登录获取token
const loginData = JSON.stringify({
  username: 'user',
  password: 'user123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

console.log('=== 步骤1：登录 ===');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('登录状态码:', res.statusCode);
    const response = JSON.parse(data);
    console.log('登录响应:', JSON.stringify(response, null, 2));
    
    if (response.token) {
      token = response.token;
      console.log('\n✓ 登录成功！\n');
      
      // 步骤2：获取任务列表
      setTimeout(() => testGetTasks(), 1000);
    } else {
      console.log('\n✗ 登录失败');
    }
  });
});

loginReq.on('error', (e) => {
  console.error('登录请求失败:', e.message);
});

loginReq.write(loginData);
loginReq.end();

// 步骤2：获取任务列表
function testGetTasks() {
  console.log('=== 步骤2：获取任务列表 ===');
  
  const tasksOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  const tasksReq = http.request(tasksOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('获取任务状态码:', res.statusCode);
      
      try {
        const tasks = JSON.parse(data);
        console.log('获取到任务数量:', Array.isArray(tasks) ? tasks.length : 0);
        
        if (Array.isArray(tasks)) {
          console.log('\n任务列表:');
          tasks.forEach(task => {
            console.log(`  - [${task.status}] ${task.title}`);
          });
          
          const publishedTasks = tasks.filter(t => t.status === 'published');
          console.log(`\n✓ 已发布任务数: ${publishedTasks.length}`);
        } else {
          console.log('响应数据:', data);
        }
      } catch (e) {
        console.error('解析失败:', e.message);
        console.log('原始数据:', data);
      }
    });
  });
  
  tasksReq.on('error', (e) => {
    console.error('获取任务失败:', e.message);
  });
  
  tasksReq.end();
}
