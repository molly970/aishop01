import express from 'express';
import db from '../database';
import { authenticateToken } from './auth';

const router = express.Router();

router.get('/', authenticateToken, (req: any, res) => {
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.get('/unread-count', authenticateToken, (req: any, res) => {
  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id],
    (err: any, row: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ count: row.count });
    }
  );
});

router.put('/:id/read', authenticateToken, (req: any, res) => {
  db.run(
    'UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?',
    [new Date().toISOString(), req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '已标记为已读' });
    }
  );
});

router.put('/read-all', authenticateToken, (req: any, res) => {
  db.run(
    'UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ?',
    [new Date().toISOString(), req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '全部标记为已读' });
    }
  );
});

export default router;
