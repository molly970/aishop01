import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database';
import { authenticateToken } from './auth';

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

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

const notifyUsers = async (
  userIds: Array<string | null | undefined>,
  taskId: string,
  type: string,
  title: string,
  content: string
) => {
  const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  for (const userId of uniqueIds) {
    await runAsync(
      'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
      [createId(), userId, taskId, type, title, content]
    );
  }
};

const notifyMainAdmins = async (taskId: string, type: string, title: string, content: string) => {
  const admins = await allAsync<{ id: string }>('SELECT id FROM users WHERE role = "main_admin"');
  await notifyUsers(
    admins.map((admin) => admin.id),
    taskId,
    type,
    title,
    content
  );
};

router.post('/', authenticateToken, upload.any(), (req: any, res) => {
  const { task_id, task_no, description, ai_tool, prompt, usage_guide, commitment } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!task_id || !task_no) {
    return res.status(400).json({ error: '任务 ID 和任务编号不能为空' });
  }

  if (commitment !== 'true' && commitment !== true) {
    return res.status(400).json({ error: '需要勾选承诺声明' });
  }

  db.get('SELECT * FROM tasks WHERE id = ?', [task_id], (err, task: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });

    if (task.assignee_id !== req.user.id) {
      return res.status(403).json({ error: '只有被分配的用户可以提交结果' });
    }

    db.all(
      'SELECT * FROM submissions WHERE task_id = ? AND submitter_id = ? ORDER BY created_at DESC',
      [task_id, req.user.id],
      (submissionsError, existingSubmissions: any[]) => {
        if (submissionsError) return res.status(500).json({ error: submissionsError.message });

        const safeSubmissions = existingSubmissions || [];
        const latestSubmission = safeSubmissions[0];

        if (task.status === 'completed') {
          return res.status(400).json({ error: '该任务已完成，不可再次填写提交结果' });
        }

        if (latestSubmission?.status === 'pending') {
          return res.status(400).json({ error: '当前已有待验收结果，请等待审核后再操作' });
        }

        if (latestSubmission?.status === 'rejected' && safeSubmissions.length >= 2) {
          return res.status(400).json({ error: '提交结果已被拒绝两次，不可再次填写' });
        }

        if (safeSubmissions.length > 0 && latestSubmission?.status !== 'rejected') {
          return res.status(400).json({ error: '当前不可再次提交结果' });
        }

        const submissionId = createId();
        const submissionCreatedAt = new Date().toISOString();

        db.run(
          `INSERT INTO submissions (
             id, task_id, task_no, submitter_id, submitter_name, description, ai_tool, prompt, usage_guide, commitment, status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            submissionId,
            task_id,
            task_no,
            req.user.id,
            req.user.name,
            description || '',
            ai_tool || '',
            prompt || '',
            usage_guide || '',
            true,
            'pending',
            submissionCreatedAt,
          ],
          (insertError) => {
            if (insertError) return res.status(500).json({ error: insertError.message });

            if (files && files.length > 0) {
              files.forEach((file) => {
                const fileId = createId();
                const fileType = file.fieldname === 'result' ? 'result' : 'screenshot';

                db.run(
                  `INSERT INTO files (
                     id, submission_id, task_id, file_type, file_name, file_path, file_size, mime_type, uploaded_by
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [fileId, submissionId, task_id, fileType, file.originalname, file.path, file.size, file.mimetype, req.user.id]
                );
              });
            }

            const progressLogId = createId();
            const progressDescription =
              (typeof description === 'string' && description.trim()) || '已提交任务结果，等待验收';

            db.run(
              `INSERT INTO task_progress_logs (
                 id, task_id, progress, description, updater_id, updater_name, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [progressLogId, task_id, 100, progressDescription, req.user.id, req.user.name, submissionCreatedAt]
            );

            db.run('UPDATE tasks SET updated_at = ? WHERE id = ?', [submissionCreatedAt, task_id]);

            void notifyUsers(
              [task.submitter_id],
              task_id,
              'submission_created',
              '任务结果已提交',
              `您发布的任务《${task.title}》已有新的完成结果提交。`
            );
            void notifyMainAdmins(
              task_id,
              'submission_created',
              '任务结果有新提交',
              `${req.user.name}已提交任务《${task.title}》的完成结果。`
            );

            res.status(201).json({
              id: submissionId,
              message: '提交成功',
            });
          }
        );
      }
    );
  });
});

router.get('/task/:taskId', (_req, res) => {
  db.all('SELECT * FROM submissions WHERE task_id = ? ORDER BY created_at DESC', [_req.params.taskId], (err, submissions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(submissions);
  });
});

router.get('/my', authenticateToken, (req: any, res) => {
  db.all('SELECT * FROM submissions WHERE submitter_id = ? ORDER BY created_at DESC', [req.user.id], (err, submissions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(submissions);
  });
});

router.get('/', authenticateToken, (req: any, res) => {
  const isReviewer = req.user.role === 'main_admin' || req.user.role === 'expert';
  const sql = isReviewer
    ? `SELECT submissions.*, tasks.title as taskTitle, tasks.task_no as taskNo
       FROM submissions
       LEFT JOIN tasks ON submissions.task_id = tasks.id
       ORDER BY submissions.created_at DESC`
    : `SELECT submissions.*, tasks.title as taskTitle, tasks.task_no as taskNo
       FROM submissions
       LEFT JOIN tasks ON submissions.task_id = tasks.id
       WHERE tasks.submitter_id = ?
       ORDER BY submissions.created_at DESC`;
  const params = isReviewer ? [] : [req.user.id];

  db.all(sql, params, (err, submissions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(submissions);
  });
});

router.get('/:id', (_req, res) => {
  db.get('SELECT * FROM submissions WHERE id = ?', [_req.params.id], (err, submission: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!submission) return res.status(404).json({ error: '提交记录不存在' });

    db.all('SELECT * FROM files WHERE submission_id = ?', [_req.params.id], (filesErr, files) => {
      if (filesErr) return res.status(500).json({ error: filesErr.message });
      res.json({ ...(submission as object), files });
    });
  });
});

router.delete('/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'main_admin') {
    return res.status(403).json({ error: '只有主管理员可以删除已审核结果' });
  }

  db.get('SELECT * FROM submissions WHERE id = ?', [req.params.id], (err, submission: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!submission) return res.status(404).json({ error: '提交记录不存在' });

    if (submission.status !== 'approved' && submission.status !== 'rejected') {
      return res.status(400).json({ error: '仅可删除已审核结果' });
    }

    db.all('SELECT * FROM files WHERE submission_id = ?', [req.params.id], (filesErr, files: any[]) => {
      if (filesErr) return res.status(500).json({ error: filesErr.message });

      (files || []).forEach((file) => {
        if (file.file_path && fs.existsSync(file.file_path)) {
          try {
            fs.unlinkSync(file.file_path);
          } catch (unlinkError) {
            console.error('Failed to remove submission file:', unlinkError);
          }
        }
      });

      db.run('DELETE FROM files WHERE submission_id = ?', [req.params.id], (deleteFilesErr) => {
        if (deleteFilesErr) return res.status(500).json({ error: deleteFilesErr.message });

        db.run(
          "DELETE FROM admin_logs WHERE target_id = ? AND target_type = 'submission'",
          [req.params.id],
          (deleteLogsErr) => {
            if (deleteLogsErr) return res.status(500).json({ error: deleteLogsErr.message });

            db.run('DELETE FROM submissions WHERE id = ?', [req.params.id], (deleteSubmissionErr) => {
              if (deleteSubmissionErr) return res.status(500).json({ error: deleteSubmissionErr.message });

              const logId = createId();
              db.run(
                'INSERT INTO admin_logs (id, admin_id, admin_name, action_type, action_detail, target_id, target_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [logId, req.user.id, req.user.name, 'submission_delete', '删除已审核结果', req.params.id, 'submission'],
                (logErr) => {
                  if (logErr) return res.status(500).json({ error: logErr.message });
                  res.json({ message: '已删除审核结果' });
                }
              );
            });
          }
        );
      });
    });
  });
});

router.put('/:id/review', authenticateToken, (req: any, res) => {
  const { approved, review_comment, ratings } = req.body;

  db.get(
    `SELECT submissions.*, tasks.submitter_id as task_submitter_id
     FROM submissions
     LEFT JOIN tasks ON submissions.task_id = tasks.id
     WHERE submissions.id = ?`,
    [req.params.id],
    (err, submission: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!submission) return res.status(404).json({ error: '提交记录不存在' });

      const isReviewer = req.user.role === 'main_admin' || req.user.role === 'expert';
      const isTaskPublisherReviewer = submission.task_submitter_id === req.user.id;
      if (!isReviewer && !isTaskPublisherReviewer) {
        return res.status(403).json({ error: '无权限审核该结果' });
      }

      const newStatus = approved ? 'approved' : 'rejected';
      const totalRating = ratings
        ? ratings.split(',').reduce((sum: number, item: string) => sum + parseInt(item.split(':')[1], 10), 0)
        : 0;

      db.run(
        'UPDATE submissions SET status = ?, review_comment = ?, rating = ?, ratings = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?',
        [newStatus, review_comment || '', totalRating || null, ratings || null, new Date().toISOString(), req.user.id, req.params.id],
        (updateError) => {
          if (updateError) return res.status(500).json({ error: updateError.message });

          if (approved) {
            db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [
              'completed',
              new Date().toISOString(),
              submission.task_id,
            ]);

            const notificationId = createId();
            db.run(
              'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
              [notificationId, submission.submitter_id, submission.task_id, 'review_completed', '结果验收通过', '您的任务结果已通过验收，任务已完成']
            );
          } else {
            const notificationId = createId();
            db.run(
              'INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)',
              [
                notificationId,
                submission.submitter_id,
                submission.task_id,
                'task_rejected',
                '结果验收未通过',
                review_comment || '您的任务结果未通过验收，请根据意见修改后重新提交',
              ]
            );
          }

          void notifyMainAdmins(
            submission.task_id,
            approved ? 'review_completed' : 'task_rejected',
            approved ? '结果验收已通过' : '结果验收未通过',
            `${req.user.name}已${approved ? '通过' : '拒绝'}任务结果验收，提交人：${submission.submitter_name}`
          );

          const logId = createId();
          db.run(
            'INSERT INTO admin_logs (id, admin_id, admin_name, action_type, action_detail, target_id, target_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [logId, req.user.id, req.user.name, 'submission_review', `审核结果：${approved ? '通过' : '拒绝'}`, req.params.id, 'submission']
          );

          res.json({ message: approved ? '验收通过' : '验收拒绝' });
        }
      );
    }
  );
});

export default router;
