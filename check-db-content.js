
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) =&gt; {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('数据库连接成功');
});

console.log('\n=== 查询用户表 ===');
db.all('SELECT * FROM users', (err, rows) =&gt; {
  if (err) {
    console.error('查询失败:', err.message);
  } else {
    console.log(`找到 ${rows.length} 个用户:`);
    rows.forEach(row =&gt; {
      console.log(`  - ${row.name} (${row.username}) - ${row.role}`);
    });
  }
});

console.log('\n=== 查询任务表 ===');
db.all('SELECT id, task_no, title, status, submitter_name FROM tasks ORDER BY created_at DESC', (err, rows) =&gt; {
  if (err) {
    console.error('查询失败:', err.message);
  } else {
    console.log(`找到 ${rows.length} 个任务:`);
    rows.forEach(row =&gt; {
      console.log(`  - [${row.task_no || '无编号'}] ${row.title} - 状态: ${row.status} - 提交者: ${row.submitter_name}`);
    });
  }
  db.close();
});
