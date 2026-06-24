const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
});

console.log('=== 数据库诊断报告 ===\n');

db.all('SELECT * FROM tasks', [], (err, tasks) => {
  if (err) {
    console.error('查询任务失败:', err.message);
    return db.close();
  }
  
  console.log('任务总数:', tasks.length);
  console.log('\n所有任务:');
  tasks.forEach(task => {
    console.log(`- [${task.status}] ${task.title} (ID: ${task.id})`);
  });
  
  const publishedTasks = tasks.filter(t => t.status === 'published');
  console.log(`\n已发布任务数: ${publishedTasks.length}`);
  publishedTasks.forEach(task => {
    console.log(`  ✓ ${task.title}`);
  });
  
  db.all('SELECT * FROM users', [], (err, users) => {
    if (err) {
      console.error('查询用户失败:', err.message);
      return db.close();
    }
    
    console.log('\n\n用户总数:', users.length);
    users.forEach(user => {
      console.log(`- ${user.name} (${user.username}) - ${user.role}`);
    });
    
    db.close(() => {
      console.log('\n\n诊断完成！');
    });
  });
});
