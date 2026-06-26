import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database';

const router = express.Router();

router.post('/register', async (_req, res) => {
  res.status(403).json({ error: '系统已关闭自行注册，请联系主管理员或管理员创建账号' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username], async (err, user: any) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (Number(user.is_disabled) === 1) {
      return res.status(403).json({ error: '该账号已被禁用，请联系管理员' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '24h',
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      });
    } catch {
      res.status(500).json({ error: '登录失败' });
    }
  });
});

const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未授权' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: '无效的 token' });
    }

    db.get('SELECT id, username, name, role, is_disabled FROM users WHERE id = ?', [decoded.id], (queryErr, user: any) => {
      if (queryErr || !user) {
        return res.status(403).json({ error: '用户不存在' });
      }

      if (Number(user.is_disabled) === 1) {
        return res.status(403).json({ error: '该账号已被禁用' });
      }

      req.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      };
      next();
    });
  });
};

router.get('/me', authenticateToken, (req: any, res) => {
  res.json(req.user);
});

router.put('/change-password', authenticateToken, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '当前密码和新密码不能为空' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度不能少于 6 位' });
  }

  try {
    db.get('SELECT id, password FROM users WHERE id = ?', [req.user.id], async (err, user: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: '用户不存在' });

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: '当前密码不正确' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run(
        'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
        [hashedPassword, new Date().toISOString(), req.user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          res.json({ message: '密码修改成功' });
        }
      );
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '密码修改失败' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ message: '退出成功' });
});

export { authenticateToken };
export default router;
