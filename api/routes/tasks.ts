import express from 'express';
import db from '../database';
import { authenticateToken } from './auth';
// @ts-ignore
import legacyTasksRouter from './tasks.legacy.js';

const router = express.Router();

type AppUser = {
  id: string;
  name: string;
  role: string;
};

type TaskRow = {
  id: string;
  title: string;
  submitter_id: string;
};

type ClaimRow = {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
};

const activeTaskClause = 'COALESCE(is_deleted, 0) = 0';
const createId = () => Math.random().toString(36).slice(2, 11);

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

const canAssignTaskForUser = (user?: AppUser, task?: TaskRow | null) =>
  Boolean(user && task && ((user.role === 'main_admin' || user.role === 'expert') || task.submitter_id === user.id));

router.put('/:id/assign', authenticateToken, async (req: any, res, next) => {
  try {
    const task = await getAsync<TaskRow>(`SELECT id, title, submitter_id FROM tasks WHERE id = ? AND ${activeTaskClause}`, [
      req.params.id,
    ]);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (!canAssignTaskForUser(req.user, task)) {
      return res.status(403).json({ error: '无权分配任务' });
    }

    const claimId = typeof req.body?.claimId === 'string' ? req.body.claimId : '';
    if (!claimId) {
      return res.status(400).json({ error: '缺少申领记录' });
    }

    const claim = await getAsync<ClaimRow>('SELECT id, task_id, user_id, user_name FROM claims WHERE id = ?', [claimId]);
    if (!claim) {
      return res.status(404).json({ error: '申领记录不存在' });
    }

    if (claim.task_id !== task.id) {
      return res.status(400).json({ error: '申领记录与任务不匹配' });
    }

    const assignedAt = new Date().toISOString();

    await runAsync(
      'UPDATE tasks SET status = ?, assignee_id = ?, assignee_name = ?, assigned_at = ?, updated_at = ? WHERE id = ?',
      ['assigned', claim.user_id, claim.user_name, assignedAt, assignedAt, task.id]
    );
    await runAsync('UPDATE claims SET status = ? WHERE id = ?', ['assigned', claim.id]);

    await runAsync(
      'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
      [createId(), claim.user_id, task.id, 'task_assigned', '任务已分配', '您已被分配到一个任务，请按时完成。']
    );

    await runAsync(
      'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
      [createId(), task.submitter_id, task.id, 'task_assigned', '任务分配有新结果', `您发布的任务《${task.title}》已分配给 ${claim.user_name}。`]
    );

    const mainAdmins = await allAsync<{ id: string }>('SELECT id FROM users WHERE role = "main_admin"');
    for (const admin of mainAdmins) {
      await runAsync(
        'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
        [createId(), admin.id, task.id, 'task_assigned', '任务分配有新动态', `${req.user.name}已将任务《${task.title}》分配给 ${claim.user_name}。`]
      );
    }

    return res.json({ message: '分配成功' });
  } catch (error) {
    return next(error);
  }
});

router.use(legacyTasksRouter);

export default router;
