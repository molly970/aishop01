import bcrypt from 'bcryptjs';
import express from 'express';
import multer from 'multer';
import db from '../database';
import { authenticateToken } from './auth';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const DEFAULT_RESET_PASSWORD = '123456';
const ALLOWED_ROLES = ['main_admin', 'admin', 'expert', 'user'] as const;

type AdminUser = { id: string; name: string; role?: string };
type DbUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  created_at?: string;
  updated_at?: string;
};

const createId = () => Math.random().toString(36).slice(2, 11);

const runAsync = (sql: string, params: any[] = []) =>
  new Promise<{ changes: number }>((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ changes: this.changes ?? 0 });
    });
  });

const getAsync = <T = any>(sql: string, params: any[] = []) =>
  new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const allAsync = <T = any>(sql: string, params: any[] = []) =>
  new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });

const logAdminAction = (
  admin: AdminUser,
  actionType: string,
  actionDetail: string,
  targetId?: string,
  targetType: string = 'user'
) => {
  db.run(
    'INSERT INTO admin_logs (id, admin_id, admin_name, action_type, action_detail, target_id, target_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [createId(), admin.id, admin.name, actionType, actionDetail, targetId || null, targetType]
  );
};

const ensureAdminAccess = (req: any, res: any) => {
  if (req.user.role !== 'main_admin' && req.user.role !== 'admin') {
    res.status(403).json({ error: '无权访问' });
    return false;
  }
  return true;
};

const ensureMainAdminAccess = (req: any, res: any) => {
  if (req.user.role !== 'main_admin') {
    res.status(403).json({ error: '无权访问' });
    return false;
  }
  return true;
};

const normalizeUsername = (username: string) => username.trim().toLowerCase();

const validateUserPayload = (payload: {
  username: string;
  name: string;
  password: string;
  role: string;
  operatorRole: string;
}) => {
  const { username, name, password, role, operatorRole } = payload;

  if (!username || !name || !password) {
    return '用户名、花名和密码不能为空';
  }
  if (username.length < 2) {
    return '用户名至少需要 2 个字符';
  }
  if (password.length < 6) {
    return '密码至少需要 6 个字符';
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return '无效的角色';
  }
  if (operatorRole === 'admin' && role === 'main_admin') {
    return '管理员不能创建主管理员账号';
  }
  return null;
};

const escapeCsvValue = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsvUsers = (content: string) => {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
  const usernameIndex = headers.indexOf('username');
  const nameIndex = headers.indexOf('name');
  const passwordIndex = headers.indexOf('password');
  const roleIndex = headers.indexOf('role');

  if (usernameIndex === -1 || nameIndex === -1 || passwordIndex === -1 || roleIndex === -1) {
    throw new Error('CSV 文件缺少必填表头：username,name,password,role');
  }

  return lines.slice(1).map((line, index) => {
    const columns = parseCsvLine(line);
    return {
      rowNumber: index + 2,
      username: (columns[usernameIndex] || '').trim(),
      name: (columns[nameIndex] || '').trim(),
      password: (columns[passwordIndex] || '').trim(),
      role: (columns[roleIndex] || 'user').trim(),
    };
  });
};

const createUserRecord = async (payload: {
  username: string;
  name: string;
  password: string;
  role: string;
}) => {
  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const userId = createId();

  await runAsync('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)', [
    userId,
    payload.username,
    hashedPassword,
    payload.name,
    payload.role,
  ]);

  return {
    id: userId,
    username: payload.username,
    name: payload.name,
    role: payload.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

const deleteUserAccount = async (targetUserId: string, adminUser: AdminUser) => {
  const user = await getAsync<DbUser>('SELECT id, username, name, role FROM users WHERE id = ?', [targetUserId]);
  if (!user) {
    throw new Error('用户不存在');
  }

  const now = new Date().toISOString();
  await runAsync(
    `UPDATE tasks
     SET assignee_id = NULL,
         assignee_name = NULL,
         status = CASE WHEN status = 'assigned' THEN 'published' ELSE status END,
         updated_at = ?
     WHERE assignee_id = ?`,
    [now, targetUserId]
  );
  await runAsync('DELETE FROM claims WHERE user_id = ?', [targetUserId]);
  await runAsync('DELETE FROM notifications WHERE user_id = ?', [targetUserId]);
  const result = await runAsync('DELETE FROM users WHERE id = ?', [targetUserId]);
  if (result.changes === 0) {
    throw new Error('用户不存在或已删除');
  }

  logAdminAction(adminUser, 'user_delete', `删除了账号 ${user.username}（${user.name}）`, targetUserId, 'user');
  return user;
};

router.get('/users', authenticateToken, async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;

  try {
    const rows = await allAsync<DbUser>(
      'SELECT id, username, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/export', authenticateToken, async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;

  try {
    const rows = await allAsync<Pick<DbUser, 'username' | 'name' | 'role' | 'created_at'>>(
      'SELECT username, name, role, created_at FROM users ORDER BY created_at DESC'
    );

    const csvLines = [
      'username,name,role,created_at',
      ...rows.map((item) =>
        [escapeCsvValue(item.username), escapeCsvValue(item.name), escapeCsvValue(item.role), escapeCsvValue(item.created_at)].join(',')
      ),
    ];

    logAdminAction(req.user, 'user_export', `导出了 ${rows.length} 个用户`, undefined, 'user_export');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csvLines.join('\n')}`);
  } catch (error: any) {
    res.status(500).json({ error: error.message || '导出用户失败' });
  }
});

router.post('/users/import', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;
  if (!req.file?.buffer) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const rows = parseCsvUsers(req.file.buffer.toString('utf-8'));
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的用户数据' });
    }

    const existingRows = await allAsync<{ username: string }>('SELECT username FROM users');
    const existingUsernames = new Set(existingRows.map((item) => normalizeUsername(item.username)));
    const importedUsernames = new Set<string>();
    const createdUsers: Array<{ id: string; username: string; name: string; role: string }> = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const username = row.username.trim();
      const name = row.name.trim();
      const password = row.password.trim();
      const role = row.role.trim() || 'user';
      const usernameKey = normalizeUsername(username);

      const validationError = validateUserPayload({
        username,
        name,
        password,
        role,
        operatorRole: req.user.role,
      });
      if (validationError) {
        skipped.push(`第 ${row.rowNumber} 行${validationError}`);
        continue;
      }

      if (existingUsernames.has(usernameKey) || importedUsernames.has(usernameKey)) {
        skipped.push(`第 ${row.rowNumber} 行用户名 ${username} 已存在`);
        continue;
      }

      const user = await createUserRecord({ username, name, password, role });
      existingUsernames.add(usernameKey);
      importedUsernames.add(usernameKey);
      createdUsers.push(user);
    }

    logAdminAction(
      req.user,
      'user_import',
      `批量导入用户，成功 ${createdUsers.length} 个，跳过 ${skipped.length} 个`,
      undefined,
      'user_import'
    );

    res.json({
      message: `批量导入完成：成功 ${createdUsers.length} 个，跳过 ${skipped.length} 个`,
      createdUsers,
      skipped,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '批量导入用户失败' });
  }
});

router.post('/users', authenticateToken, async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const role = typeof req.body?.role === 'string' ? req.body.role : 'user';

  const validationError = validateUserPayload({
    username,
    name,
    password,
    role,
    operatorRole: req.user.role,
  });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const existingUser = await getAsync<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const user = await createUserRecord({ username, name, password, role });
    logAdminAction(req.user, 'user_create', `新增用户 ${username}（${name}），角色为 ${role}`, user.id);
    res.status(201).json({ message: '用户创建成功', user });
  } catch (error: any) {
    const message = error?.message?.includes('UNIQUE') ? '用户名已存在' : error.message || '新增用户失败';
    res.status(500).json({ error: message });
  }
});

router.put('/users/:id/role', authenticateToken, async (req: any, res) => {
  if (!ensureMainAdminAccess(req, res)) return;

  const { role } = req.body || {};
  const targetUserId = req.params.id;

  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }
  if (targetUserId === req.user.id && role !== 'main_admin') {
    return res.status(400).json({ error: '不能降低当前主管理员自己的角色' });
  }

  try {
    if (role === 'admin') {
      const row = await getAsync<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
      if ((row?.count || 0) >= 3) {
        return res.status(400).json({ error: '普通管理员最多只能有 3 个' });
      }
    }

    const user = await getAsync<DbUser>('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await runAsync('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, new Date().toISOString(), targetUserId]);
    logAdminAction(req.user, 'user_role_change', `将用户 ${user.username} 的角色从 ${user.role} 改为 ${role}`, targetUserId);
    res.json({ message: '角色更新成功' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '更新角色失败' });
  }
});

router.put('/users/:id/reset-password', authenticateToken, async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;

  const targetUserId = req.params.id;
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: '不能在这里重置当前登录管理员自己的密码' });
  }

  const rawPassword =
    typeof req.body?.password === 'string' && req.body.password.trim()
      ? req.body.password.trim()
      : DEFAULT_RESET_PASSWORD;

  if (rawPassword.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于 6 位' });
  }

  try {
    const user = await getAsync<DbUser>('SELECT id, username, name, role FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (req.user.role === 'admin' && user.role === 'main_admin') {
      return res.status(403).json({ error: '管理员不能重置主管理员密码' });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    await runAsync('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [
      hashedPassword,
      new Date().toISOString(),
      targetUserId,
    ]);

    logAdminAction(req.user, 'user_password_reset', `重置了用户 ${user.username} 的登录密码`, targetUserId);
    res.json({ message: '密码重置成功', temporaryPassword: rawPassword });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '密码重置失败' });
  }
});

router.post('/users/batch-delete', authenticateToken, async (req: any, res) => {
  if (!ensureMainAdminAccess(req, res)) return;

  const ids: string[] = Array.isArray(req.body?.ids)
    ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length === 0) {
    return res.status(400).json({ error: '请选择要删除的账号' });
  }
  if (uniqueIds.includes(req.user.id)) {
    return res.status(400).json({ error: '不能批量删除当前登录的主管理员账号' });
  }

  try {
    const deletedUsers: DbUser[] = [];
    for (const id of uniqueIds) {
      const deletedUser = await deleteUserAccount(id, req.user);
      deletedUsers.push(deletedUser);
    }

    logAdminAction(
      req.user,
      'user_batch_delete',
      `批量删除了 ${deletedUsers.length} 个账号：${deletedUsers.map((item) => item.username).join('、')}`,
      undefined,
      'user_batch'
    );

    res.json({
      message: `批量删除成功，共删除 ${deletedUsers.length} 个账号`,
      deletedIds: deletedUsers.map((item) => item.id),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '批量删除账号失败' });
  }
});

router.delete('/users/:id', authenticateToken, async (req: any, res) => {
  if (!ensureMainAdminAccess(req, res)) return;

  const targetUserId = req.params.id;
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: '不能删除当前登录的主管理员账号' });
  }

  try {
    await deleteUserAccount(targetUserId, req.user);
    res.json({ message: '账号删除成功' });
  } catch (error: any) {
    const status = error.message === '用户不存在' ? 404 : 500;
    res.status(status).json({ error: error.message || '删除账号失败' });
  }
});

router.get('/admins', authenticateToken, async (req: any, res) => {
  if (!ensureMainAdminAccess(req, res)) return;

  try {
    const rows = await allAsync<DbUser>(
      'SELECT id, username, name, role, created_at, updated_at FROM users WHERE role = "admin" OR role = "main_admin" ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs', authenticateToken, async (req: any, res) => {
  if (!ensureAdminAccess(req, res)) return;

  try {
    const rows = await allAsync('SELECT * FROM admin_logs ORDER BY created_at DESC');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/init-test-data', authenticateToken, (_req: any, res) => {
  return res.status(403).json({ error: '测试数据初始化已关闭' });
});

export default router;
