const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 检查数据库内容...');

db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
  if (err) {
    console.error('❌ 查询任务表失败:', err.message);
    process.exit(1);
  }
  
  console.log(`📊 任务总数: ${row.count}`);
  
  if (row.count > 0) {
    db.all('SELECT id, task_no, title, status FROM tasks', (err, rows) => {
      if (err) {
        console.error('❌ 查询任务失败:', err.message);
        process.exit(1);
      }
      
      console.log('\n📋 任务列表:');
      rows.forEach(task => {
        console.log(`  - [${task.status}] ${task.task_no}: ${task.title}`);
      });
      
      db.close();
    });
  } else {
    console.log('\n⚠️ 数据库中没有任务！需要初始化测试数据');
    db.close();
  }
});
