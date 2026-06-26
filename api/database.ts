import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'database.sqlite'), (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initDatabase();
  }
});

const TASK_RECYCLE_RETENTION_DAYS = 7;

type SqliteRow = Record<string, any>;

const runAsync = (sql: string, params: any[] = []) =>
  new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const allAsync = <T = SqliteRow>(sql: string, params: any[] = []) =>
  new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });

const getAsync = <T = SqliteRow>(sql: string, params: any[] = []) =>
  new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

async function purgeExpiredDeletedTasks() {
  const columns = await allAsync<{ name: string }>('PRAGMA table_info(tasks)');
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('is_deleted') || !columnNames.has('deleted_at')) {
    return;
  }

  const cutoff = new Date(Date.now() - TASK_RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const expiredTasks = await allAsync<{ id: string }>(
    'SELECT id FROM tasks WHERE COALESCE(is_deleted, 0) = 1 AND deleted_at IS NOT NULL AND deleted_at <= ?',
    [cutoff]
  );

  for (const task of expiredTasks) {
    const submissions = await allAsync<{ id: string }>('SELECT id FROM submissions WHERE task_id = ?', [task.id]);
    const submissionIds = submissions.map((submission) => submission.id);

    if (submissionIds.length > 0) {
      const placeholders = submissionIds.map(() => '?').join(',');
      await runAsync(`DELETE FROM files WHERE submission_id IN (${placeholders})`, submissionIds);
    }

    await runAsync('DELETE FROM files WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM notifications WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM claims WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM task_approvals WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM task_progress_logs WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM submissions WHERE task_id = ?', [task.id]);
    await runAsync('DELETE FROM tasks WHERE id = ?', [task.id]);
  }
}

function ensureTaskRecycleColumns() {
  db.all('PRAGMA table_info(tasks)', async (err, columns: any[]) => {
    if (err) {
      console.error('Failed to inspect task columns:', err.message);
      return;
    }

    const columnNames = new Set((columns || []).map((column) => column.name));

    try {
      if (!columnNames.has('is_deleted')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('deleted_at')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP');
      }
      if (!columnNames.has('deleted_by')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN deleted_by TEXT');
      }
      if (!columnNames.has('deleted_by_name')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN deleted_by_name TEXT');
      }
      if (!columnNames.has('assigned_at')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN assigned_at TIMESTAMP');
      }
      if (!columnNames.has('is_publicized')) {
        await runAsync('ALTER TABLE tasks ADD COLUMN is_publicized INTEGER NOT NULL DEFAULT 0');
      }

      await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_at ON tasks(assigned_at)');
      await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_is_publicized ON tasks(is_publicized)');
      await purgeExpiredDeletedTasks();
    } catch (migrationError: any) {
      console.error('Failed to prepare task recycle columns:', migrationError.message);
    }
  });
}

function ensureUserDisableColumns() {
  db.all('PRAGMA table_info(users)', async (err, columns: any[]) => {
    if (err) {
      console.error('Failed to inspect user columns:', err.message);
      return;
    }

    const columnNames = new Set((columns || []).map((column) => column.name));

    try {
      if (!columnNames.has('is_disabled')) {
        await runAsync('ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('disabled_at')) {
        await runAsync('ALTER TABLE users ADD COLUMN disabled_at TIMESTAMP');
      }
      if (!columnNames.has('disabled_by')) {
        await runAsync('ALTER TABLE users ADD COLUMN disabled_by TEXT');
      }
      if (!columnNames.has('disabled_by_name')) {
        await runAsync('ALTER TABLE users ADD COLUMN disabled_by_name TEXT');
      }

      await runAsync('CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON users(is_disabled)');
    } catch (migrationError: any) {
      console.error('Failed to prepare user disable columns:', migrationError.message);
    }
  });
}

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    ensureUserDisableColumns();

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        task_no TEXT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        reward INTEGER NOT NULL DEFAULT 0,
        reward_type TEXT DEFAULT 'points',
        reward_item TEXT,
        difficulty TEXT NOT NULL,
        expected_deadline DATE NOT NULL,
        priority TEXT DEFAULT 'medium',
        rating INTEGER DEFAULT 0,
        ratings TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        submitter_id TEXT NOT NULL,
        submitter_name TEXT NOT NULL,
        assignee_id TEXT,
        assignee_name TEXT,
        assigned_at TIMESTAMP,
        is_publicized INTEGER NOT NULL DEFAULT 0,
        review_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submitter_id) REFERENCES users(id)
      )
    `);

    ensureTaskRecycleColumns();

    db.run(`
      CREATE TABLE IF NOT EXISTS task_approvals (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        task_no TEXT,
        approver_id TEXT NOT NULL,
        approver_name TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        comment TEXT,
        ratings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (approver_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS task_progress_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        progress INTEGER NOT NULL,
        description TEXT,
        updater_id TEXT NOT NULL,
        updater_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (updater_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        task_no TEXT NOT NULL,
        submitter_id TEXT NOT NULL,
        submitter_name TEXT NOT NULL,
        description TEXT,
        ai_tool TEXT,
        prompt TEXT,
        usage_guide TEXT,
        commitment BOOLEAN DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending',
        review_comment TEXT,
        rating INTEGER,
        ratings TEXT,
        reviewed_at TIMESTAMP,
        reviewed_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (submitter_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        submission_id TEXT,
        task_id TEXT,
        file_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT,
        uploaded_by TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        dingtalk_sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_detail TEXT NOT NULL,
        target_id TEXT,
        target_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_submitter_id ON tasks(submitter_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_task_no ON tasks(task_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_expected_deadline ON tasks(expected_deadline)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_approvals_task_id ON task_approvals(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_approvals_approver_id ON task_approvals(approver_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_approvals_created_at ON task_approvals(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_progress_logs_task_id ON task_progress_logs(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_progress_logs_created_at ON task_progress_logs(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_claims_task_id ON claims(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON submissions(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_task_no ON submissions(task_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_submitter_id ON submissions(submitter_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_files_submission_id ON files(submission_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at)`);

    db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"', async (err, row: any) => {
      if (!err && row && row.count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(
          'INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)',
          ['admin-id', 'admin', hashedPassword, 'Administrator', 'main_admin'],
          function(err) {
            if (err) console.error('Insert admin error:', err.message);
          }
        );
      }
    });

    db.get('SELECT COUNT(*) as count FROM users WHERE role = "expert"', async (err, row: any) => {
      if (!err && row && row.count === 0) {
        const hashedPassword = await bcrypt.hash('expert123', 10);
        db.run(
          'INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)',
          ['expert-id', 'expert', hashedPassword, 'Expert', 'expert'],
          function(err) {
            if (err) console.error('Insert expert error:', err.message);
          }
        );
      }
    });

    db.get('SELECT COUNT(*) as count FROM users WHERE role = "user"', async (err, row: any) => {
      if (!err && row && row.count === 0) {
        const hashedPassword = await bcrypt.hash('user123', 10);
        db.run(
          'INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)',
          ['user-id', 'user', hashedPassword, 'User', 'user'],
          function(err) {
            if (err) console.error('Insert user error:', err.message);
          }
        );
      }
    });

    db.get('SELECT COUNT(*) as count FROM tasks', (err, row: any) => {
      if (!err && row && row.count === 0) {
        console.log('📥 数据库为空，开始初始化测试数据...');
        db.run(`
          INSERT INTO tasks (id, task_no, title, description, type, reward, reward_type, difficulty, expected_deadline, priority, rating, status, submitter_id, submitter_name)
          VALUES 
            ('task-1', 'AI-20260501-1', 'AI图像识别模型训练', '使用深度学习训练一个图像识别模型，识别常见物体', 'model_training', 500, 'points', 'complex', '2026-06-30', 'high', 5, 'published', 'user-id', '普通用户'),
            ('task-2', 'AI-20260502-1', '数据分析报告生成', '使用AI工具分析销售数据并生成报告', 'data_analysis', 200, 'points', 'medium', '2026-06-15', 'medium', 3, 'published', 'user-id', '普通用户'),
            ('task-3', 'AI-20260503-1', '智能客服对话优化', '优化智能客服的对话逻辑，提升用户体验', 'ai_research', 300, 'points', 'medium', '2026-06-20', 'high', 4, 'published', 'user-id', '普通用户'),
            ('task-4', 'AI-20260504-1', '文档自动摘要生成', '开发文档自动摘要功能，支持多种格式', 'other', 150, 'points', 'simple', '2026-06-10', 'low', 2, 'published', 'user-id', '普通用户'),
            ('task-5', 'AI-20260505-1', '机器学习算法研究', '研究新的机器学习算法在推荐系统中的应用', 'ai_research', 800, 'points', 'complex', '2026-07-15', 'high', 6, 'pending', 'user-id', '普通用户'),
            ('task-6', 'AI-20260506-1', 'AI文案生成工具', '开发一个AI辅助文案生成工具，支持多种场景', 'other', 400, 'points', 'medium', '2026-06-25', 'medium', 4, 'published', 'user-id', '普通用户'),
            ('task-7', 'AI-20260507-1', '智能问答系统开发', '开发基于大语言模型的智能问答系统', 'ai_research', 600, 'points', 'complex', '2026-07-28', 'high', 5, 'published', 'user-id', '普通用户'),
            ('task-8', 'AI-20260508-1', '数据可视化大屏', '设计并实现数据可视化大屏展示系统', 'data_analysis', 350, 'points', 'medium', '2026-06-20', 'medium', 3, 'published', 'user-id', '普通用户')
        `, (err) => {
          if (err) {
            console.error('❌ 初始化测试任务失败:', err);
          } else {
            console.log('✅ 测试任务初始化成功，已添加8个测试任务（6个已发布，2个待审核）');
          }
        });
      } else if (!err && row) {
        console.log(`📊 数据库中已有 ${row.count} 个任务`);
      } else {
        console.error('❌ 查询任务数量失败:', err);
      }
    });
  });
}

export { purgeExpiredDeletedTasks, TASK_RECYCLE_RETENTION_DAYS };
export default db;
