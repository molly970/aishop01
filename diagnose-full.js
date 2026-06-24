const http = require('http');

console.log('=== 开始诊断AI任务集市问题 ===\n');

// Step 1: 检查后端健康
async function checkHealth() {
  console.log('1. 检查后端健康状态...');
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('   状态码:', res.statusCode);
        console.log('   响应:', data);
        if (res.statusCode === 200) {
          console.log('   ✅ 后端正常\n');
          resolve(true);
        } else {
          console.log('   ❌ 后端有问题\n');
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log('   ❌ 无法连接后端:', e.message);
      console.log('   💡 请确保后端服务器已启动: npm run dev:backend\n');
      resolve(false);
    });
    
    req.end();
  });
}

// Step 2: 登录获取token
async function login() {
  console.log('2. 登录获取Token...');
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({ username: 'user', password: 'user123' });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('   状态码:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('   响应:', JSON.stringify(json, null, 2));
          if (json.token) {
            console.log('   ✅ 登录成功\n');
            resolve(json.token);
          } else {
            console.log('   ❌ 登录失败\n');
            resolve(null);
          }
        } catch (e) {
          console.log('   响应:', data);
          console.log('   ❌ 解析响应失败\n');
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log('   ❌ 登录请求失败:', e.message, '\n');
      resolve(null);
    });
    
    req.write(loginData);
    req.end();
  });
}

// Step 3: 获取任务列表
async function getTasks(token) {
  console.log('3. 获取任务列表...');
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('   状态码:', res.statusCode);
        try {
          const tasks = JSON.parse(data);
          console.log('   响应:', JSON.stringify(tasks, null, 2));
          if (Array.isArray(tasks)) {
            console.log('   ✅ 成功获取', tasks.length, '个任务');
            console.log('\n   📋 任务列表:');
            tasks.forEach((t, i) => {
              console.log(`    ${i+1}. [${t.status}] ${t.title} (${t.id})`);
            });
            console.log();
            resolve(tasks);
          } else {
            console.log('   ❌ 返回不是数组\n');
            resolve(null);
          }
        } catch (e) {
          console.log('   原始响应:', data);
          console.log('   ❌ 解析响应失败\n');
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log('   ❌ 获取任务失败:', e.message, '\n');
      resolve(null);
    });
    
    req.end();
  });
}

// Step 4: 查询数据库
async function checkDatabase() {
  console.log('4. 检查数据库...');
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.join(__dirname, 'data', 'database.sqlite');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.log('   ❌ 无法打开数据库:', err.message, '\n');
        resolve(false);
        return;
      }
      
      console.log('   ✅ 数据库连接成功');
      
      db.all('SELECT id, title, status, submitter_name FROM tasks', [], (err, rows) => {
        if (err) {
          console.log('   ❌ 查询失败:', err.message, '\n');
          db.close();
          resolve(false);
          return;
        }
        
        console.log('   📊 数据库中的任务:', rows.length, '个');
        rows.forEach(r => {
          console.log(`    - [${r.status}] ${r.title} (${r.id})`);
        });
        
        db.close();
        console.log();
        resolve(true);
      });
    });
  });
}

// 运行所有诊断
async function runDiagnosis() {
  console.log('🔍 开始全面诊断...\n');
  
  await checkHealth();
  
  await checkDatabase();
  
  const token = await login();
  
  if (token) {
    await getTasks(token);
  }
  
  console.log('✅ 诊断完成！');
}

runDiagnosis().catch(console.error);
