"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importStar(require("../database"));
const auth_1 = require("./auth");
const router = express_1.default.Router();
const createId = () => Math.random().toString(36).slice(2, 11);
const activeTaskClause = 'COALESCE(is_deleted, 0) = 0';
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    database_1.default.run(sql, params, function (err) {
        if (err) {
            reject(err);
            return;
        }
        resolve({ changes: this.changes ?? 0 });
    });
});
const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    database_1.default.get(sql, params, (err, row) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(row);
    });
});
const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    database_1.default.all(sql, params, (err, rows) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(rows || []);
    });
});
const ensureTaskOperationsAllowed = (user) => user?.role === 'main_admin' || user?.role === 'admin' || user?.role === 'expert';
const ensureMainAdmin = (user) => user?.role === 'main_admin';
const ensureAdminControlsAllowed = (user) => user?.role === 'main_admin' || user?.role === 'admin';
const getOptionalRequestUser = (req) => new Promise((resolve) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        resolve(null);
        return;
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret', (verifyErr, decoded) => {
        if (verifyErr || !decoded?.id) {
            resolve(null);
            return;
        }
        database_1.default.get('SELECT id, name, role FROM users WHERE id = ?', [decoded.id], (queryErr, user) => {
            if (queryErr || !user) {
                resolve(null);
                return;
            }
            resolve(user);
        });
    });
});
const buildRatingsTotal = (ratings) => {
    if (!ratings)
        return 0;
    return ratings
        .split(',')
        .map((entry) => parseInt(entry.split(':')[1], 10))
        .filter((value) => Number.isFinite(value))
        .reduce((sum, value) => sum + value, 0);
};
const generateTaskNo = async () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const row = await getAsync('SELECT COUNT(*) as count FROM tasks WHERE task_no LIKE ?', [`${dateStr}-%`]);
    return `${dateStr}-${(row?.count || 0) + 1}`;
};
const logAdminAction = (admin, actionType, actionDetail, targetId) => {
    database_1.default.run('INSERT INTO admin_logs (id, admin_id, admin_name, action_type, action_detail, target_id, target_type) VALUES (?, ?, ?, ?, ?, ?, ?)', [createId(), admin.id, admin.name, actionType, actionDetail, targetId || null, 'task']);
};
const softDeleteTask = async (taskId, admin) => {
    await (0, database_1.purgeExpiredDeletedTasks)();
    const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [taskId]);
    if (!task) {
        return { error: '任务不存在或已删除', status: 404 };
    }
    const now = new Date().toISOString();
    const updateResult = await runAsync(`UPDATE tasks
     SET is_deleted = 1,
         deleted_at = ?,
         deleted_by = ?,
         deleted_by_name = ?,
         updated_at = ?
     WHERE id = ? AND ${activeTaskClause}`, [now, admin.id, admin.name, now, taskId]);
    if (updateResult.changes === 0) {
        return { error: '任务删除失败，请稍后重试', status: 500 };
    }
    logAdminAction(admin, 'task_delete', `删除了任务《${task.title}》`, taskId);
    return {
        message: '任务已移入回收站，7天后将自动彻底清除',
        deletedTask: task,
    };
};
router.get('/', async (req, res) => {
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const { status, type, search } = req.query;
        let query = `SELECT * FROM tasks WHERE ${activeTaskClause}`;
        const params = [];
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        else {
            query += ' AND status IN ("published", "claimed")';
        }
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        if (search) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const tasks = await allAsync(query, params);
        if (tasks.length === 0) {
            return res.json([]);
        }
        const taskIds = tasks.map((task) => task.id);
        const placeholders = taskIds.map(() => '?').join(',');
        const claimCounts = await allAsync(`SELECT task_id, COUNT(*) as count FROM claims WHERE task_id IN (${placeholders}) GROUP BY task_id`, taskIds);
        const claimMap = new Map();
        claimCounts.forEach((claim) => claimMap.set(claim.task_id, claim.count));
        res.json(tasks.map((task) => ({
            ...task,
            claimCount: claimMap.get(task.id) || 0,
        })));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const rows = await allAsync(`SELECT * FROM tasks
       WHERE ${activeTaskClause}
         AND (submitter_id = ? OR assignee_id = ?)
       ORDER BY created_at DESC`, [req.user.id, req.user.id]);
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/my-claims', auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const rows = await allAsync(`SELECT
         t.*,
         c.id AS claim_id,
         c.status AS claim_status,
         c.claimed_at
       FROM claims c
       INNER JOIN tasks t ON t.id = c.task_id
       WHERE c.user_id = ?
         AND ${activeTaskClause}
       ORDER BY c.claimed_at DESC`, [req.user.id]);
        const payload = rows.map((row) => {
            let applicationStatus = '待分配';
            if (row.status === 'assigned') {
                applicationStatus = row.assignee_id === req.user.id ? '已分配' : '已分配给他人';
            }
            else if (row.status === 'completed') {
                applicationStatus = row.assignee_id === req.user.id ? '已完成' : '已分配给他人';
            }
            else if (row.status === 'cancelled') {
                applicationStatus = '任务已取消';
            }
            return {
                ...row,
                application_status: applicationStatus,
            };
        });
        res.json(payload);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/pending', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权查看待审核任务' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const { search } = req.query;
        let query = `SELECT * FROM tasks WHERE ${activeTaskClause} AND status = "pending"`;
        const params = [];
        if (search) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const tasks = await allAsync(query, params);
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/reviewed', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权查看已审核任务' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const { search, status } = req.query;
        let query = `SELECT * FROM tasks WHERE ${activeTaskClause} AND status != "pending"`;
        const params = [];
        if (status) {
            query = `SELECT * FROM tasks WHERE ${activeTaskClause} AND status = ?`;
            params.push(status);
        }
        if (search) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const tasks = await allAsync(query, params);
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/claims', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权查看任务申领' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const tasks = await allAsync(`SELECT * FROM tasks
       WHERE ${activeTaskClause}
         AND status IN ("claimed", "assigned")
       ORDER BY created_at DESC`);
        const taskIds = tasks.map((task) => task.id);
        if (taskIds.length === 0) {
            return res.json([]);
        }
        const placeholders = taskIds.map(() => '?').join(',');
        const claims = await allAsync(`SELECT * FROM claims WHERE task_id IN (${placeholders}) ORDER BY claimed_at DESC`, taskIds);
        const claimsMap = new Map();
        claims.forEach((claim) => {
            const list = claimsMap.get(claim.task_id) || [];
            list.push(claim);
            claimsMap.set(claim.task_id, list);
        });
        res.json(tasks.map((task) => ({
            ...task,
            claims: claimsMap.get(task.id) || [],
        })));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/public-board', async (req, res) => {
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const requestUser = await getOptionalRequestUser(req);
        const visibilityClause = requestUser
            ? 'AND (COALESCE(tasks.is_publicized, 0) = 1 OR tasks.submitter_id = ? OR tasks.assignee_id = ?)'
            : 'AND COALESCE(tasks.is_publicized, 0) = 1';
        const params = requestUser ? [requestUser.id, requestUser.id] : [];
        const tasks = await allAsync(`SELECT
         tasks.*,
         latest_progress.progress AS latest_progress,
         latest_progress.description AS latest_progress_description,
         latest_progress.created_at AS latest_progress_updated_at,
         latest_submission.status AS latest_submission_status
       FROM tasks
       LEFT JOIN (
         SELECT tpl.task_id, tpl.progress, tpl.description, tpl.created_at
         FROM task_progress_logs tpl
         INNER JOIN (
           SELECT task_id, MAX(created_at) AS max_created_at
           FROM task_progress_logs
           GROUP BY task_id
         ) latest
           ON latest.task_id = tpl.task_id
          AND latest.max_created_at = tpl.created_at
       ) latest_progress
         ON latest_progress.task_id = tasks.id
       LEFT JOIN (
         SELECT s1.task_id, s1.status, s1.created_at
         FROM submissions s1
         INNER JOIN (
           SELECT task_id, MAX(created_at) AS max_created_at
           FROM submissions
           GROUP BY task_id
         ) latest_submission_time
           ON latest_submission_time.task_id = s1.task_id
          AND latest_submission_time.max_created_at = s1.created_at
       ) latest_submission
         ON latest_submission.task_id = tasks.id
       WHERE ${activeTaskClause}
         ${visibilityClause}
         AND tasks.status IN ("assigned", "completed")
       ORDER BY COALESCE(latest_progress.created_at, assigned_at, updated_at) DESC, updated_at DESC`, params);
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/recycle-bin', auth_1.authenticateToken, async (req, res) => {
    if (!ensureMainAdmin(req.user)) {
        return res.status(403).json({ error: '无权查看任务回收站' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const tasks = await allAsync(`SELECT * FROM tasks
       WHERE COALESCE(is_deleted, 0) = 1
       ORDER BY deleted_at DESC, updated_at DESC`);
        const payload = tasks.map((task) => {
            const deletedAt = task.deleted_at ? new Date(task.deleted_at).getTime() : Date.now();
            const expireAt = deletedAt + database_1.TASK_RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
            const remainingMs = Math.max(expireAt - Date.now(), 0);
            const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
            return {
                ...task,
                remainingDays,
            };
        });
        res.json(payload);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/batch-delete', auth_1.authenticateToken, async (req, res) => {
    if (!ensureMainAdmin(req.user)) {
        return res.status(403).json({ error: '无权批量删除任务' });
    }
    const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.filter((id) => typeof id === 'string' && id.trim().length > 0)
        : [];
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
        return res.status(400).json({ error: '请选择要删除的任务' });
    }
    try {
        const deletedIds = [];
        for (const id of uniqueIds) {
            const result = await softDeleteTask(id, req.user);
            if ('error' in result) {
                return res.status(result.status || 500).json({ error: result.error });
            }
            deletedIds.push(id);
        }
        logAdminAction(req.user, 'task_batch_delete', `批量删除了 ${deletedIds.length} 个任务`, deletedIds.join(','));
        res.json({
            message: `批量删除成功，共删除 ${deletedIds.length} 个任务`,
            deletedIds,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        const [claims, submissions, approvals, progressLogs] = await Promise.all([
            allAsync('SELECT * FROM claims WHERE task_id = ? ORDER BY claimed_at DESC', [req.params.id]),
            allAsync('SELECT * FROM submissions WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]),
            allAsync('SELECT * FROM task_approvals WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]),
            allAsync('SELECT * FROM task_progress_logs WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]),
        ]);
        const latestProgress = progressLogs[0];
        res.json({
            ...task,
            claims,
            submissions,
            approvals,
            progressLogs,
            latest_progress: latestProgress?.progress ?? null,
            latest_progress_description: latestProgress?.description ?? null,
            latest_progress_updated_at: latestProgress?.created_at ?? null,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/approvals', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权查看审批记录' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const approvals = await allAsync('SELECT * FROM task_approvals WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(approvals);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/claims', auth_1.authenticateToken, async (req, res) => {
    if (req.user.role !== 'main_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权查看申领记录' });
    }
    try {
        await (0, database_1.purgeExpiredDeletedTasks)();
        const claims = await allAsync('SELECT * FROM claims WHERE task_id = ? ORDER BY claimed_at DESC', [req.params.id]);
        res.json(claims);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { title, description, type, reward, reward_type, reward_item, difficulty, expected_deadline, priority } = req.body;
    if (!title || !difficulty || !expected_deadline) {
        return res.status(400).json({ error: '标题、难度和期望完成时间不能为空' });
    }
    try {
        const taskId = createId();
        const now = new Date().toISOString();
        const task = {
            id: taskId,
            title,
            description: description || '',
            type: type || 'other',
            reward: parseInt(reward, 10) || 0,
            reward_type: reward_type || 'points',
            reward_item: reward_item || null,
            difficulty,
            expected_deadline,
            priority: priority || 'medium',
            rating: 0,
            status: 'pending',
            submitter_id: req.user.id,
            submitter_name: req.user.name,
            created_at: now,
            updated_at: now,
        };
        await runAsync(`INSERT INTO tasks (
        id, title, description, type, reward, reward_type, reward_item, difficulty,
        expected_deadline, priority, rating, status, submitter_id, submitter_name,
        created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`, [
            task.id,
            task.title,
            task.description,
            task.type,
            task.reward,
            task.reward_type,
            task.reward_item,
            task.difficulty,
            task.expected_deadline,
            task.priority,
            task.rating,
            task.status,
            task.submitter_id,
            task.submitter_name,
            task.created_at,
            task.updated_at,
        ]);
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id/review', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权审核任务' });
    }
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        const { approved, comment, ratings } = req.body;
        const oldStatus = task.status;
        const newStatus = approved ? 'published' : 'cancelled';
        const action = approved ? 'approve' : 'reject';
        const totalRating = buildRatingsTotal(ratings);
        const approvalId = createId();
        if (approved) {
            const taskNo = await generateTaskNo();
            await runAsync(`UPDATE tasks
         SET status = ?, rating = ?, review_comment = ?, ratings = ?, task_no = ?, updated_at = ?
         WHERE id = ?`, ['published', totalRating || 1, comment || '', ratings || null, taskNo, new Date().toISOString(), req.params.id]);
            await runAsync('INSERT INTO task_approvals (id, task_id, task_no, approver_id, approver_name, approver_role, action, old_status, new_status, comment, ratings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [approvalId, req.params.id, taskNo, req.user.id, req.user.name, req.user.role, action, oldStatus, newStatus, comment || '', ratings || null]);
            return res.json({ message: '任务已发布', taskNo });
        }
        await runAsync('UPDATE tasks SET status = ?, rating = 0, review_comment = ?, ratings = NULL, updated_at = ? WHERE id = ?', ['cancelled', comment || '', new Date().toISOString(), req.params.id]);
        await runAsync('INSERT INTO task_approvals (id, task_id, task_no, approver_id, approver_name, approver_role, action, old_status, new_status, comment, ratings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [approvalId, req.params.id, task.task_no || null, req.user.id, req.user.name, req.user.role, action, oldStatus, newStatus, comment || '', null]);
        await runAsync('INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)', [
            createId(),
            task.submitter_id,
            task.id,
            'task_rejected',
            '任务审核未通过',
            comment || '您的任务未通过审核，请联系管理员了解详情。',
        ]);
        res.json({ message: '任务已拒绝' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/claim', auth_1.authenticateToken, async (req, res) => {
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        if (task.status !== 'published' && task.status !== 'claimed') {
            return res.status(400).json({ error: '任务当前不可申领' });
        }
        const existingClaim = await getAsync('SELECT * FROM claims WHERE task_id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (existingClaim) {
            return res.status(400).json({ error: '您已经申领过这个任务' });
        }
        const claimId = createId();
        await runAsync('INSERT INTO claims (id, task_id, user_id, user_name, status) VALUES (?, ?, ?, ?, ?)', [claimId, req.params.id, req.user.id, req.user.name, 'pending']);
        if (task.status === 'published') {
            await runAsync('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', ['claimed', new Date().toISOString(), req.params.id]);
        }
        const admins = await allAsync('SELECT id FROM users WHERE role IN ("main_admin", "admin")');
        for (const admin of admins) {
            await runAsync('INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)', [createId(), admin.id, req.params.id, 'task_claimed', '新任务申领', `用户 ${req.user.name} 申领了任务：${task.title}`]);
        }
        res.status(201).json({ message: '申领成功', id: claimId });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id/assign', auth_1.authenticateToken, async (req, res) => {
    if (!ensureTaskOperationsAllowed(req.user)) {
        return res.status(403).json({ error: '无权分配任务' });
    }
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        const { claimId } = req.body;
        const claim = await getAsync('SELECT * FROM claims WHERE id = ?', [claimId]);
        if (!claim) {
            return res.status(404).json({ error: '申领记录不存在' });
        }
        const assignedAt = new Date().toISOString();
        await runAsync('UPDATE tasks SET status = ?, assignee_id = ?, assignee_name = ?, assigned_at = ?, updated_at = ? WHERE id = ?', ['assigned', claim.user_id, claim.user_name, assignedAt, assignedAt, req.params.id]);
        await runAsync('UPDATE claims SET status = ? WHERE id = ?', ['assigned', claimId]);
        await runAsync('INSERT INTO notifications (id, user_id, task_id, type, title, content) VALUES (?, ?, ?, ?, ?, ?)', [createId(), claim.user_id, req.params.id, 'task_assigned', '任务已分配', '您已被分配到一个任务，请按时完成。']);
        logAdminAction(req.user, 'task_assign', `将任务《${task.title}》分配给 ${claim.user_name}`, req.params.id);
        res.json({ message: '分配成功' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id/reissue', auth_1.authenticateToken, async (req, res) => {
    if (req.user.role !== 'main_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权重新发布任务' });
    }
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        const { expected_deadline } = req.body;
        await runAsync('UPDATE tasks SET status = ?, expected_deadline = COALESCE(?, expected_deadline), updated_at = ? WHERE id = ?', ['published', expected_deadline || null, new Date().toISOString(), req.params.id]);
        res.json({ message: '任务已重新发布' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id/publicity', auth_1.authenticateToken, async (req, res) => {
    if (!ensureAdminControlsAllowed(req.user)) {
        return res.status(403).json({ error: '无权设置任务公示状态' });
    }
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        const isPublicized = req.body?.isPublicized ? 1 : 0;
        if (isPublicized === 1 && task.status !== 'assigned' && task.status !== 'completed') {
            return res.status(400).json({ error: '仅已分配或已完成的任务可以公示' });
        }
        await runAsync('UPDATE tasks SET is_publicized = ?, updated_at = ? WHERE id = ?', [
            isPublicized,
            new Date().toISOString(),
            req.params.id,
        ]);
        logAdminAction(req.user, 'task_publicity_update', `${isPublicized === 1 ? '将任务设为公示' : '将任务设为不公示'}：${task.title}`, req.params.id);
        res.json({
            message: isPublicized === 1 ? '任务已设为公示' : '任务已设为不公示',
            is_publicized: isPublicized,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/progress', auth_1.authenticateToken, async (req, res) => {
    try {
        const task = await getAsync(`SELECT * FROM tasks WHERE id = ? AND ${activeTaskClause}`, [req.params.id]);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        if (task.assignee_id !== req.user.id) {
            return res.status(403).json({ error: '只有当前任务承接方可以登记进度' });
        }
        if (task.status !== 'assigned' && task.status !== 'completed') {
            return res.status(400).json({ error: '当前任务状态不支持登记进度' });
        }
        const rawProgress = Number(req.body?.progress);
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        if (!Number.isFinite(rawProgress) || rawProgress < 0 || rawProgress > 100) {
            return res.status(400).json({ error: '任务进度需填写 0 到 100 之间的百分比' });
        }
        const progress = Math.round(rawProgress);
        const latestProgressLog = await getAsync('SELECT * FROM task_progress_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1', [task.id]);
        if (latestProgressLog && progress <= latestProgressLog.progress) {
            return res.status(400).json({
                error: `本次任务进度必须大于上一次登记的 ${latestProgressLog.progress}%`,
            });
        }
        const progressId = createId();
        const createdAt = new Date().toISOString();
        await runAsync(`INSERT INTO task_progress_logs (id, task_id, progress, description, updater_id, updater_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [progressId, task.id, progress, description || null, req.user.id, req.user.name, createdAt]);
        await runAsync('UPDATE tasks SET updated_at = ? WHERE id = ?', [createdAt, task.id]);
        res.status(201).json({
            id: progressId,
            task_id: task.id,
            progress,
            description,
            updater_id: req.user.id,
            updater_name: req.user.name,
            created_at: createdAt,
            message: '任务进度登记成功',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    if (!ensureMainAdmin(req.user)) {
        return res.status(403).json({ error: '无权删除任务' });
    }
    try {
        const result = await softDeleteTask(req.params.id, req.user);
        if ('error' in result) {
            return res.status(result.status || 500).json({ error: result.error });
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRDovYWlzaG9wMDEvYXBpL3JvdXRlcy90YXNrcy50cyIsInNvdXJjZXMiOlsiRDovYWlzaG9wMDEvYXBpL3JvdXRlcy90YXNrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHNEQUE4QjtBQUM5QixnRUFBK0I7QUFDL0Isd0RBQXdGO0FBQ3hGLGlDQUEyQztBQUUzQyxNQUFNLE1BQU0sR0FBRyxpQkFBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBMERoQyxNQUFNLFFBQVEsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDL0QsTUFBTSxnQkFBZ0IsR0FBRyw2QkFBNkIsQ0FBQztBQUV2RCxNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQVcsRUFBRSxTQUFnQixFQUFFLEVBQUUsRUFBRSxDQUNuRCxJQUFJLE9BQU8sQ0FBc0IsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7SUFDbkQsa0JBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxVQUFVLEdBQUc7UUFDL0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNSLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNaLE9BQU87UUFDVCxDQUFDO1FBQ0QsT0FBTyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMxQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUwsTUFBTSxRQUFRLEdBQUcsQ0FBVSxHQUFXLEVBQUUsU0FBZ0IsRUFBRSxFQUFFLEVBQUUsQ0FDNUQsSUFBSSxPQUFPLENBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO0lBQzdDLGtCQUFFLENBQUMsR0FBRyxD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QUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sY0FBYyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3RCxJQUFJLE9BQU8sSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztBQUNILENBQUMsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsTUFBTSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgand0IGZyb20gJ2pzb253ZWJ0b2tlbic7XG5pbXBvcnQgZGIsIHsgVEFTS19SRUNZQ0xFX1JFVEVOVElPTl9EQVlTLCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MgfSBmcm9tICcuLi9kYXRhYmFzZSc7XG5pbXBvcnQgeyBhdXRoZW50aWNhdGVUb2tlbiB9IGZyb20gJy4vYXV0aCc7XG5cbmNvbnN0IHJvdXRlciA9IGV4cHJlc3MuUm91dGVyKCk7XG5cbnR5cGUgQXBwVXNlciA9IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICByb2xlOiBzdHJpbmc7XG59O1xuXG50eXBlIFRhc2tSb3cgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRhc2tfbm8/OiBzdHJpbmcgfCBudWxsO1xuICB0aXRsZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZyB8IG51bGw7XG4gIHR5cGU6IHN0cmluZztcbiAgcmV3YXJkOiBudW1iZXI7XG4gIHJld2FyZF90eXBlPzogc3RyaW5nIHwgbnVsbDtcbiAgcmV3YXJkX2l0ZW0/OiBzdHJpbmcgfCBudWxsO1xuICBkaWZmaWN1bHR5OiBzdHJpbmc7XG4gIGV4cGVjdGVkX2RlYWRsaW5lOiBzdHJpbmc7XG4gIHByaW9yaXR5Pzogc3RyaW5nIHwgbnVsbDtcbiAgcmF0aW5nOiBudW1iZXI7XG4gIHJhdGluZ3M/OiBzdHJpbmcgfCBudWxsO1xuICBzdGF0dXM6IHN0cmluZztcbiAgc3VibWl0dGVyX2lkOiBzdHJpbmc7XG4gIHN1Ym1pdHRlcl9uYW1lOiBzdHJpbmc7XG4gIGFzc2lnbmVlX2lkPzogc3RyaW5nIHwgbnVsbDtcbiAgYXNzaWduZWVfbmFtZT86IHN0cmluZyB8IG51bGw7XG4gIGFzc2lnbmVkX2F0Pzogc3RyaW5nIHwgbnVsbDtcbiAgaXNfcHVibGljaXplZD86IG51bWJlciB8IG51bGw7XG4gIGxhdGVzdF9wcm9ncmVzcz86IG51bWJlciB8IG51bGw7XG4gIGxhdGVzdF9wcm9ncmVzc19kZXNjcmlwdGlvbj86IHN0cmluZyB8IG51bGw7XG4gIGxhdGVzdF9wcm9ncmVzc191cGRhdGVkX2F0Pzogc3RyaW5nIHwgbnVsbDtcbiAgbGF0ZXN0X3N1Ym1pc3Npb25fc3RhdHVzPzogc3RyaW5nIHwgbnVsbDtcbiAgcmV2aWV3X2NvbW1lbnQ/OiBzdHJpbmcgfCBudWxsO1xuICBjcmVhdGVkX2F0OiBzdHJpbmc7XG4gIHVwZGF0ZWRfYXQ6IHN0cmluZztcbiAgZGVsZXRlZF9hdD86IHN0cmluZyB8IG51bGw7XG4gIGRlbGV0ZWRfYnk/OiBzdHJpbmcgfCBudWxsO1xuICBkZWxldGVkX2J5X25hbWU/OiBzdHJpbmcgfCBudWxsO1xufTtcblxudHlwZSBUYXNrUHJvZ3Jlc3NSb3cgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRhc2tfaWQ6IHN0cmluZztcbiAgcHJvZ3Jlc3M6IG51bWJlcjtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcgfCBudWxsO1xuICB1cGRhdGVyX2lkOiBzdHJpbmc7XG4gIHVwZGF0ZXJfbmFtZTogc3RyaW5nO1xuICBjcmVhdGVkX2F0OiBzdHJpbmc7XG59O1xuXG50eXBlIE15Q2xhaW1Sb3cgPSBUYXNrUm93ICYge1xuICBjbGFpbV9pZDogc3RyaW5nO1xuICBjbGFpbV9zdGF0dXM6IHN0cmluZztcbiAgY2xhaW1lZF9hdDogc3RyaW5nO1xuICBhcHBsaWNhdGlvbl9zdGF0dXM6IHN0cmluZztcbn07XG5cbmNvbnN0IGNyZWF0ZUlkID0gKCkgPT4gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgMTEpO1xuY29uc3QgYWN0aXZlVGFza0NsYXVzZSA9ICdDT0FMRVNDRShpc19kZWxldGVkLCAwKSA9IDAnO1xuXG5jb25zdCBydW5Bc3luYyA9IChzcWw6IHN0cmluZywgcGFyYW1zOiBhbnlbXSA9IFtdKSA9PlxuICBuZXcgUHJvbWlzZTx7IGNoYW5nZXM6IG51bWJlciB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgZGIucnVuKHNxbCwgcGFyYW1zLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXNvbHZlKHsgY2hhbmdlczogdGhpcy5jaGFuZ2VzID8/IDAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG5jb25zdCBnZXRBc3luYyA9IDxUID0gYW55PihzcWw6IHN0cmluZywgcGFyYW1zOiBhbnlbXSA9IFtdKSA9PlxuICBuZXcgUHJvbWlzZTxUIHwgdW5kZWZpbmVkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgZGIuZ2V0KHNxbCwgcGFyYW1zLCAoZXJyLCByb3c6IFQpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJlc29sdmUocm93KTtcbiAgICB9KTtcbiAgfSk7XG5cbmNvbnN0IGFsbEFzeW5jID0gPFQgPSBhbnk+KHNxbDogc3RyaW5nLCBwYXJhbXM6IGFueVtdID0gW10pID0+XG4gIG5ldyBQcm9taXNlPFRbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGRiLmFsbChzcWwsIHBhcmFtcywgKGVyciwgcm93czogVFtdKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXNvbHZlKHJvd3MgfHwgW10pO1xuICAgIH0pO1xuICB9KTtcblxuY29uc3QgZW5zdXJlVGFza09wZXJhdGlvbnNBbGxvd2VkID0gKHVzZXI/OiBBcHBVc2VyKSA9PlxuICB1c2VyPy5yb2xlID09PSAnbWFpbl9hZG1pbicgfHwgdXNlcj8ucm9sZSA9PT0gJ2FkbWluJyB8fCB1c2VyPy5yb2xlID09PSAnZXhwZXJ0JztcblxuY29uc3QgZW5zdXJlTWFpbkFkbWluID0gKHVzZXI/OiBBcHBVc2VyKSA9PiB1c2VyPy5yb2xlID09PSAnbWFpbl9hZG1pbic7XG5jb25zdCBlbnN1cmVBZG1pbkNvbnRyb2xzQWxsb3dlZCA9ICh1c2VyPzogQXBwVXNlcikgPT4gdXNlcj8ucm9sZSA9PT0gJ21haW5fYWRtaW4nIHx8IHVzZXI/LnJvbGUgPT09ICdhZG1pbic7XG5cbmNvbnN0IGdldE9wdGlvbmFsUmVxdWVzdFVzZXIgPSAocmVxOiBhbnkpID0+XG4gIG5ldyBQcm9taXNlPEFwcFVzZXIgfCBudWxsPigocmVzb2x2ZSkgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbj8uc3BsaXQoJyAnKVsxXTtcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGp3dC52ZXJpZnkodG9rZW4sIHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgJ3NlY3JldCcsICh2ZXJpZnlFcnI6IGFueSwgZGVjb2RlZDogYW55KSA9PiB7XG4gICAgICBpZiAodmVyaWZ5RXJyIHx8ICFkZWNvZGVkPy5pZCkge1xuICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGRiLmdldCgnU0VMRUNUIGlkLCBuYW1lLCByb2xlIEZST00gdXNlcnMgV0hFUkUgaWQgPSA/JywgW2RlY29kZWQuaWRdLCAocXVlcnlFcnIsIHVzZXI6IGFueSkgPT4ge1xuICAgICAgICBpZiAocXVlcnlFcnIgfHwgIXVzZXIpIHtcbiAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHVzZXIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG5jb25zdCBidWlsZFJhdGluZ3NUb3RhbCA9IChyYXRpbmdzPzogc3RyaW5nKSA9PiB7XG4gIGlmICghcmF0aW5ncykgcmV0dXJuIDA7XG4gIHJldHVybiByYXRpbmdzXG4gICAgLnNwbGl0KCcsJylcbiAgICAubWFwKChlbnRyeSkgPT4gcGFyc2VJbnQoZW50cnkuc3BsaXQoJzonKVsxXSwgMTApKVxuICAgIC5maWx0ZXIoKHZhbHVlKSA9PiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpKVxuICAgIC5yZWR1Y2UoKHN1bSwgdmFsdWUpID0+IHN1bSArIHZhbHVlLCAwKTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlVGFza05vID0gYXN5bmMgKCkgPT4ge1xuICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gIGNvbnN0IGRhdGVTdHIgPSB0b2RheS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKS5yZXBsYWNlKC8tL2csICcnKTtcbiAgY29uc3Qgcm93ID0gYXdhaXQgZ2V0QXN5bmM8eyBjb3VudDogbnVtYmVyIH0+KFxuICAgICdTRUxFQ1QgQ09VTlQoKikgYXMgY291bnQgRlJPTSB0YXNrcyBXSEVSRSB0YXNrX25vIExJS0UgPycsXG4gICAgW2Ake2RhdGVTdHJ9LSVgXVxuICApO1xuICByZXR1cm4gYCR7ZGF0ZVN0cn0tJHsocm93Py5jb3VudCB8fCAwKSArIDF9YDtcbn07XG5cbmNvbnN0IGxvZ0FkbWluQWN0aW9uID0gKGFkbWluOiBBcHBVc2VyLCBhY3Rpb25UeXBlOiBzdHJpbmcsIGFjdGlvbkRldGFpbDogc3RyaW5nLCB0YXJnZXRJZD86IHN0cmluZykgPT4ge1xuICBkYi5ydW4oXG4gICAgJ0lOU0VSVCBJTlRPIGFkbWluX2xvZ3MgKGlkLCBhZG1pbl9pZCwgYWRtaW5fbmFtZSwgYWN0aW9uX3R5cGUsIGFjdGlvbl9kZXRhaWwsIHRhcmdldF9pZCwgdGFyZ2V0X3R5cGUpIFZBTFVFUyAoPywgPywgPywgPywgPywgPywgPyknLFxuICAgIFtjcmVhdGVJZCgpLCBhZG1pbi5pZCwgYWRtaW4ubmFtZSwgYWN0aW9uVHlwZSwgYWN0aW9uRGV0YWlsLCB0YXJnZXRJZCB8fCBudWxsLCAndGFzayddXG4gICk7XG59O1xuXG5jb25zdCBzb2Z0RGVsZXRlVGFzayA9IGFzeW5jICh0YXNrSWQ6IHN0cmluZywgYWRtaW46IEFwcFVzZXIpID0+IHtcbiAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG5cbiAgY29uc3QgdGFzayA9IGF3YWl0IGdldEFzeW5jPFRhc2tSb3c+KFxuICAgIGBTRUxFQ1QgKiBGUk9NIHRhc2tzIFdIRVJFIGlkID0gPyBBTkQgJHthY3RpdmVUYXNrQ2xhdXNlfWAsXG4gICAgW3Rhc2tJZF1cbiAgKTtcblxuICBpZiAoIXRhc2spIHtcbiAgICByZXR1cm4geyBlcnJvcjogJ+S7u+WKoeS4jeWtmOWcqOaIluW3suWIoOmZpCcsIHN0YXR1czogNDA0IGFzIGNvbnN0IH07XG4gIH1cblxuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gIGNvbnN0IHVwZGF0ZVJlc3VsdCA9IGF3YWl0IHJ1bkFzeW5jKFxuICAgIGBVUERBVEUgdGFza3NcbiAgICAgU0VUIGlzX2RlbGV0ZWQgPSAxLFxuICAgICAgICAgZGVsZXRlZF9hdCA9ID8sXG4gICAgICAgICBkZWxldGVkX2J5ID0gPyxcbiAgICAgICAgIGRlbGV0ZWRfYnlfbmFtZSA9ID8sXG4gICAgICAgICB1cGRhdGVkX2F0ID0gP1xuICAgICBXSEVSRSBpZCA9ID8gQU5EICR7YWN0aXZlVGFza0NsYXVzZX1gLFxuICAgIFtub3csIGFkbWluLmlkLCBhZG1pbi5uYW1lLCBub3csIHRhc2tJZF1cbiAgKTtcblxuICBpZiAodXBkYXRlUmVzdWx0LmNoYW5nZXMgPT09IDApIHtcbiAgICByZXR1cm4geyBlcnJvcjogJ+S7u+WKoeWIoOmZpOWksei0pe+8jOivt+eojeWQjumHjeivlScsIHN0YXR1czogNTAwIGFzIGNvbnN0IH07XG4gIH1cblxuICBsb2dBZG1pbkFjdGlvbihhZG1pbiwgJ3Rhc2tfZGVsZXRlJywgYOWIoOmZpOS6huS7u+WKoeOAiiR7dGFzay50aXRsZX3jgItgLCB0YXNrSWQpO1xuXG4gIHJldHVybiB7XG4gICAgbWVzc2FnZTogJ+S7u+WKoeW3suenu+WFpeWbnuaUtuerme+8jDflpKnlkI7lsIboh6rliqjlvbvlupXmuIXpmaQnLFxuICAgIGRlbGV0ZWRUYXNrOiB0YXNrLFxuICB9O1xufTtcblxucm91dGVyLmdldCgnLycsIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG5cbiAgICBjb25zdCB7IHN0YXR1cywgdHlwZSwgc2VhcmNoIH0gPSByZXEucXVlcnk7XG4gICAgbGV0IHF1ZXJ5ID0gYFNFTEVDVCAqIEZST00gdGFza3MgV0hFUkUgJHthY3RpdmVUYXNrQ2xhdXNlfWA7XG4gICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgaWYgKHN0YXR1cykge1xuICAgICAgcXVlcnkgKz0gJyBBTkQgc3RhdHVzID0gPyc7XG4gICAgICBwYXJhbXMucHVzaChzdGF0dXMgYXMgc3RyaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcXVlcnkgKz0gJyBBTkQgc3RhdHVzIElOIChcInB1Ymxpc2hlZFwiLCBcImNsYWltZWRcIiknO1xuICAgIH1cblxuICAgIGlmICh0eXBlKSB7XG4gICAgICBxdWVyeSArPSAnIEFORCB0eXBlID0gPyc7XG4gICAgICBwYXJhbXMucHVzaCh0eXBlIGFzIHN0cmluZyk7XG4gICAgfVxuXG4gICAgaWYgKHNlYXJjaCkge1xuICAgICAgcXVlcnkgKz0gJyBBTkQgKHRpdGxlIExJS0UgPyBPUiBkZXNjcmlwdGlvbiBMSUtFID8pJztcbiAgICAgIHBhcmFtcy5wdXNoKGAlJHtzZWFyY2h9JWAsIGAlJHtzZWFyY2h9JWApO1xuICAgIH1cblxuICAgIHF1ZXJ5ICs9ICcgT1JERVIgQlkgY3JlYXRlZF9hdCBERVNDJztcblxuICAgIGNvbnN0IHRhc2tzID0gYXdhaXQgYWxsQXN5bmM8VGFza1Jvdz4ocXVlcnksIHBhcmFtcyk7XG4gICAgaWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHJlcy5qc29uKFtdKTtcbiAgICB9XG5cbiAgICBjb25zdCB0YXNrSWRzID0gdGFza3MubWFwKCh0YXNrKSA9PiB0YXNrLmlkKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0YXNrSWRzLm1hcCgoKSA9PiAnPycpLmpvaW4oJywnKTtcbiAgICBjb25zdCBjbGFpbUNvdW50cyA9IGF3YWl0IGFsbEFzeW5jPHsgdGFza19pZDogc3RyaW5nOyBjb3VudDogbnVtYmVyIH0+KFxuICAgICAgYFNFTEVDVCB0YXNrX2lkLCBDT1VOVCgqKSBhcyBjb3VudCBGUk9NIGNsYWltcyBXSEVSRSB0YXNrX2lkIElOICgke3BsYWNlaG9sZGVyc30pIEdST1VQIEJZIHRhc2tfaWRgLFxuICAgICAgdGFza0lkc1xuICAgICk7XG5cbiAgICBjb25zdCBjbGFpbU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY2xhaW1Db3VudHMuZm9yRWFjaCgoY2xhaW0pID0+IGNsYWltTWFwLnNldChjbGFpbS50YXNrX2lkLCBjbGFpbS5jb3VudCkpO1xuXG4gICAgcmVzLmpzb24oXG4gICAgICB0YXNrcy5tYXAoKHRhc2spID0+ICh7XG4gICAgICAgIC4uLnRhc2ssXG4gICAgICAgIGNsYWltQ291bnQ6IGNsYWltTWFwLmdldCh0YXNrLmlkKSB8fCAwLFxuICAgICAgfSkpXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIuZ2V0KCcvbXknLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgYWxsQXN5bmMoXG4gICAgICBgU0VMRUNUICogRlJPTSB0YXNrc1xuICAgICAgIFdIRVJFICR7YWN0aXZlVGFza0NsYXVzZX1cbiAgICAgICAgIEFORCAoc3VibWl0dGVyX2lkID0gPyBPUiBhc3NpZ25lZV9pZCA9ID8pXG4gICAgICAgT1JERVIgQlkgY3JlYXRlZF9hdCBERVNDYCxcbiAgICAgIFtyZXEudXNlci5pZCwgcmVxLnVzZXIuaWRdXG4gICAgKTtcbiAgICByZXMuanNvbihyb3dzKTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIuZ2V0KCcvbXktY2xhaW1zJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgYWxsQXN5bmM8TXlDbGFpbVJvdz4oXG4gICAgICBgU0VMRUNUXG4gICAgICAgICB0LiosXG4gICAgICAgICBjLmlkIEFTIGNsYWltX2lkLFxuICAgICAgICAgYy5zdGF0dXMgQVMgY2xhaW1fc3RhdHVzLFxuICAgICAgICAgYy5jbGFpbWVkX2F0XG4gICAgICAgRlJPTSBjbGFpbXMgY1xuICAgICAgIElOTkVSIEpPSU4gdGFza3MgdCBPTiB0LmlkID0gYy50YXNrX2lkXG4gICAgICAgV0hFUkUgYy51c2VyX2lkID0gP1xuICAgICAgICAgQU5EICR7YWN0aXZlVGFza0NsYXVzZX1cbiAgICAgICBPUkRFUiBCWSBjLmNsYWltZWRfYXQgREVTQ2AsXG4gICAgICBbcmVxLnVzZXIuaWRdXG4gICAgKTtcblxuICAgIGNvbnN0IHBheWxvYWQgPSByb3dzLm1hcCgocm93KSA9PiB7XG4gICAgICBsZXQgYXBwbGljYXRpb25TdGF0dXMgPSAn5b6F5YiG6YWNJztcblxuICAgICAgaWYgKHJvdy5zdGF0dXMgPT09ICdhc3NpZ25lZCcpIHtcbiAgICAgICAgYXBwbGljYXRpb25TdGF0dXMgPSByb3cuYXNzaWduZWVfaWQgPT09IHJlcS51c2VyLmlkID8gJ+W3suWIhumFjScgOiAn5bey5YiG6YWN57uZ5LuW5Lq6JztcbiAgICAgIH0gZWxzZSBpZiAocm93LnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgICAgYXBwbGljYXRpb25TdGF0dXMgPSByb3cuYXNzaWduZWVfaWQgPT09IHJlcS51c2VyLmlkID8gJ+W3suWujOaIkCcgOiAn5bey5YiG6YWN57uZ5LuW5Lq6JztcbiAgICAgIH0gZWxzZSBpZiAocm93LnN0YXR1cyA9PT0gJ2NhbmNlbGxlZCcpIHtcbiAgICAgICAgYXBwbGljYXRpb25TdGF0dXMgPSAn5Lu75Yqh5bey5Y+W5raIJztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucm93LFxuICAgICAgICBhcHBsaWNhdGlvbl9zdGF0dXM6IGFwcGxpY2F0aW9uU3RhdHVzLFxuICAgICAgfTtcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHBheWxvYWQpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5nZXQoJy9wZW5kaW5nJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGlmICghZW5zdXJlVGFza09wZXJhdGlvbnNBbGxvd2VkKHJlcS51c2VyKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAn5peg5p2D5p+l55yL5b6F5a6h5qC45Lu75YqhJyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG4gICAgY29uc3QgeyBzZWFyY2ggfSA9IHJlcS5xdWVyeTtcbiAgICBsZXQgcXVlcnkgPSBgU0VMRUNUICogRlJPTSB0YXNrcyBXSEVSRSAke2FjdGl2ZVRhc2tDbGF1c2V9IEFORCBzdGF0dXMgPSBcInBlbmRpbmdcImA7XG4gICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgaWYgKHNlYXJjaCkge1xuICAgICAgcXVlcnkgKz0gJyBBTkQgKHRpdGxlIExJS0UgPyBPUiBkZXNjcmlwdGlvbiBMSUtFID8pJztcbiAgICAgIHBhcmFtcy5wdXNoKGAlJHtzZWFyY2h9JWAsIGAlJHtzZWFyY2h9JWApO1xuICAgIH1cblxuICAgIHF1ZXJ5ICs9ICcgT1JERVIgQlkgY3JlYXRlZF9hdCBERVNDJztcbiAgICBjb25zdCB0YXNrcyA9IGF3YWl0IGFsbEFzeW5jKHF1ZXJ5LCBwYXJhbXMpO1xuICAgIHJlcy5qc29uKHRhc2tzKTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIuZ2V0KCcvcmV2aWV3ZWQnLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKCFlbnN1cmVUYXNrT3BlcmF0aW9uc0FsbG93ZWQocmVxLnVzZXIpKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICfml6DmnYPmn6XnnIvlt7LlrqHmoLjku7vliqEnIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCB7IHNlYXJjaCwgc3RhdHVzIH0gPSByZXEucXVlcnk7XG4gICAgbGV0IHF1ZXJ5ID0gYFNFTEVDVCAqIEZST00gdGFza3MgV0hFUkUgJHthY3RpdmVUYXNrQ2xhdXNlfSBBTkQgc3RhdHVzICE9IFwicGVuZGluZ1wiYDtcbiAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG5cbiAgICBpZiAoc3RhdHVzKSB7XG4gICAgICBxdWVyeSA9IGBTRUxFQ1QgKiBGUk9NIHRhc2tzIFdIRVJFICR7YWN0aXZlVGFza0NsYXVzZX0gQU5EIHN0YXR1cyA9ID9gO1xuICAgICAgcGFyYW1zLnB1c2goc3RhdHVzKTtcbiAgICB9XG5cbiAgICBpZiAoc2VhcmNoKSB7XG4gICAgICBxdWVyeSArPSAnIEFORCAodGl0bGUgTElLRSA/IE9SIGRlc2NyaXB0aW9uIExJS0UgPyknO1xuICAgICAgcGFyYW1zLnB1c2goYCUke3NlYXJjaH0lYCwgYCUke3NlYXJjaH0lYCk7XG4gICAgfVxuXG4gICAgcXVlcnkgKz0gJyBPUkRFUiBCWSBjcmVhdGVkX2F0IERFU0MnO1xuICAgIGNvbnN0IHRhc2tzID0gYXdhaXQgYWxsQXN5bmMocXVlcnksIHBhcmFtcyk7XG4gICAgcmVzLmpzb24odGFza3MpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5nZXQoJy9jbGFpbXMnLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKCFlbnN1cmVUYXNrT3BlcmF0aW9uc0FsbG93ZWQocmVxLnVzZXIpKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICfml6DmnYPmn6XnnIvku7vliqHnlLPpooYnIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCB0YXNrcyA9IGF3YWl0IGFsbEFzeW5jPFRhc2tSb3c+KFxuICAgICAgYFNFTEVDVCAqIEZST00gdGFza3NcbiAgICAgICBXSEVSRSAke2FjdGl2ZVRhc2tDbGF1c2V9XG4gICAgICAgICBBTkQgc3RhdHVzIElOIChcImNsYWltZWRcIiwgXCJhc3NpZ25lZFwiKVxuICAgICAgIE9SREVSIEJZIGNyZWF0ZWRfYXQgREVTQ2BcbiAgICApO1xuXG4gICAgY29uc3QgdGFza0lkcyA9IHRhc2tzLm1hcCgodGFzaykgPT4gdGFzay5pZCk7XG4gICAgaWYgKHRhc2tJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gcmVzLmpzb24oW10pO1xuICAgIH1cblxuICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHRhc2tJZHMubWFwKCgpID0+ICc/Jykuam9pbignLCcpO1xuICAgIGNvbnN0IGNsYWltcyA9IGF3YWl0IGFsbEFzeW5jPGFueT4oXG4gICAgICBgU0VMRUNUICogRlJPTSBjbGFpbXMgV0hFUkUgdGFza19pZCBJTiAoJHtwbGFjZWhvbGRlcnN9KSBPUkRFUiBCWSBjbGFpbWVkX2F0IERFU0NgLFxuICAgICAgdGFza0lkc1xuICAgICk7XG5cbiAgICBjb25zdCBjbGFpbXNNYXAgPSBuZXcgTWFwPHN0cmluZywgYW55W10+KCk7XG4gICAgY2xhaW1zLmZvckVhY2goKGNsYWltKSA9PiB7XG4gICAgICBjb25zdCBsaXN0ID0gY2xhaW1zTWFwLmdldChjbGFpbS50YXNrX2lkKSB8fCBbXTtcbiAgICAgIGxpc3QucHVzaChjbGFpbSk7XG4gICAgICBjbGFpbXNNYXAuc2V0KGNsYWltLnRhc2tfaWQsIGxpc3QpO1xuICAgIH0pO1xuXG4gICAgcmVzLmpzb24oXG4gICAgICB0YXNrcy5tYXAoKHRhc2spID0+ICh7XG4gICAgICAgIC4uLnRhc2ssXG4gICAgICAgIGNsYWltczogY2xhaW1zTWFwLmdldCh0YXNrLmlkKSB8fCBbXSxcbiAgICAgIH0pKVxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLmdldCgnL3B1YmxpYy1ib2FyZCcsIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG4gICAgY29uc3QgcmVxdWVzdFVzZXIgPSBhd2FpdCBnZXRPcHRpb25hbFJlcXVlc3RVc2VyKHJlcSk7XG4gICAgY29uc3QgdmlzaWJpbGl0eUNsYXVzZSA9IHJlcXVlc3RVc2VyXG4gICAgICA/ICdBTkQgKENPQUxFU0NFKHRhc2tzLmlzX3B1YmxpY2l6ZWQsIDApID0gMSBPUiB0YXNrcy5zdWJtaXR0ZXJfaWQgPSA/IE9SIHRhc2tzLmFzc2lnbmVlX2lkID0gPyknXG4gICAgICA6ICdBTkQgQ09BTEVTQ0UodGFza3MuaXNfcHVibGljaXplZCwgMCkgPSAxJztcbiAgICBjb25zdCBwYXJhbXMgPSByZXF1ZXN0VXNlciA/IFtyZXF1ZXN0VXNlci5pZCwgcmVxdWVzdFVzZXIuaWRdIDogW107XG4gICAgY29uc3QgdGFza3MgPSBhd2FpdCBhbGxBc3luYzxUYXNrUm93PihcbiAgICAgIGBTRUxFQ1RcbiAgICAgICAgIHRhc2tzLiosXG4gICAgICAgICBsYXRlc3RfcHJvZ3Jlc3MucHJvZ3Jlc3MgQVMgbGF0ZXN0X3Byb2dyZXNzLFxuICAgICAgICAgbGF0ZXN0X3Byb2dyZXNzLmRlc2NyaXB0aW9uIEFTIGxhdGVzdF9wcm9ncmVzc19kZXNjcmlwdGlvbixcbiAgICAgICAgIGxhdGVzdF9wcm9ncmVzcy5jcmVhdGVkX2F0IEFTIGxhdGVzdF9wcm9ncmVzc191cGRhdGVkX2F0LFxuICAgICAgICAgbGF0ZXN0X3N1Ym1pc3Npb24uc3RhdHVzIEFTIGxhdGVzdF9zdWJtaXNzaW9uX3N0YXR1c1xuICAgICAgIEZST00gdGFza3NcbiAgICAgICBMRUZUIEpPSU4gKFxuICAgICAgICAgU0VMRUNUIHRwbC50YXNrX2lkLCB0cGwucHJvZ3Jlc3MsIHRwbC5kZXNjcmlwdGlvbiwgdHBsLmNyZWF0ZWRfYXRcbiAgICAgICAgIEZST00gdGFza19wcm9ncmVzc19sb2dzIHRwbFxuICAgICAgICAgSU5ORVIgSk9JTiAoXG4gICAgICAgICAgIFNFTEVDVCB0YXNrX2lkLCBNQVgoY3JlYXRlZF9hdCkgQVMgbWF4X2NyZWF0ZWRfYXRcbiAgICAgICAgICAgRlJPTSB0YXNrX3Byb2dyZXNzX2xvZ3NcbiAgICAgICAgICAgR1JPVVAgQlkgdGFza19pZFxuICAgICAgICAgKSBsYXRlc3RcbiAgICAgICAgICAgT04gbGF0ZXN0LnRhc2tfaWQgPSB0cGwudGFza19pZFxuICAgICAgICAgIEFORCBsYXRlc3QubWF4X2NyZWF0ZWRfYXQgPSB0cGwuY3JlYXRlZF9hdFxuICAgICAgICkgbGF0ZXN0X3Byb2dyZXNzXG4gICAgICAgICBPTiBsYXRlc3RfcHJvZ3Jlc3MudGFza19pZCA9IHRhc2tzLmlkXG4gICAgICAgTEVGVCBKT0lOIChcbiAgICAgICAgIFNFTEVDVCBzMS50YXNrX2lkLCBzMS5zdGF0dXMsIHMxLmNyZWF0ZWRfYXRcbiAgICAgICAgIEZST00gc3VibWlzc2lvbnMgczFcbiAgICAgICAgIElOTkVSIEpPSU4gKFxuICAgICAgICAgICBTRUxFQ1QgdGFza19pZCwgTUFYKGNyZWF0ZWRfYXQpIEFTIG1heF9jcmVhdGVkX2F0XG4gICAgICAgICAgIEZST00gc3VibWlzc2lvbnNcbiAgICAgICAgICAgR1JPVVAgQlkgdGFza19pZFxuICAgICAgICAgKSBsYXRlc3Rfc3VibWlzc2lvbl90aW1lXG4gICAgICAgICAgIE9OIGxhdGVzdF9zdWJtaXNzaW9uX3RpbWUudGFza19pZCA9IHMxLnRhc2tfaWRcbiAgICAgICAgICBBTkQgbGF0ZXN0X3N1Ym1pc3Npb25fdGltZS5tYXhfY3JlYXRlZF9hdCA9IHMxLmNyZWF0ZWRfYXRcbiAgICAgICApIGxhdGVzdF9zdWJtaXNzaW9uXG4gICAgICAgICBPTiBsYXRlc3Rfc3VibWlzc2lvbi50YXNrX2lkID0gdGFza3MuaWRcbiAgICAgICBXSEVSRSAke2FjdGl2ZVRhc2tDbGF1c2V9XG4gICAgICAgICAke3Zpc2liaWxpdHlDbGF1c2V9XG4gICAgICAgICBBTkQgdGFza3Muc3RhdHVzIElOIChcImFzc2lnbmVkXCIsIFwiY29tcGxldGVkXCIpXG4gICAgICAgT1JERVIgQlkgQ09BTEVTQ0UobGF0ZXN0X3Byb2dyZXNzLmNyZWF0ZWRfYXQsIGFzc2lnbmVkX2F0LCB1cGRhdGVkX2F0KSBERVNDLCB1cGRhdGVkX2F0IERFU0NgLFxuICAgICAgcGFyYW1zXG4gICAgKTtcbiAgICByZXMuanNvbih0YXNrcyk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLmdldCgnL3JlY3ljbGUtYmluJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGlmICghZW5zdXJlTWFpbkFkbWluKHJlcS51c2VyKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAn5peg5p2D5p+l55yL5Lu75Yqh5Zue5pS256uZJyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgYXdhaXQgcHVyZ2VFeHBpcmVkRGVsZXRlZFRhc2tzKCk7XG4gICAgY29uc3QgdGFza3MgPSBhd2FpdCBhbGxBc3luYzxUYXNrUm93PihcbiAgICAgIGBTRUxFQ1QgKiBGUk9NIHRhc2tzXG4gICAgICAgV0hFUkUgQ09BTEVTQ0UoaXNfZGVsZXRlZCwgMCkgPSAxXG4gICAgICAgT1JERVIgQlkgZGVsZXRlZF9hdCBERVNDLCB1cGRhdGVkX2F0IERFU0NgXG4gICAgKTtcblxuICAgIGNvbnN0IHBheWxvYWQgPSB0YXNrcy5tYXAoKHRhc2spID0+IHtcbiAgICAgIGNvbnN0IGRlbGV0ZWRBdCA9IHRhc2suZGVsZXRlZF9hdCA/IG5ldyBEYXRlKHRhc2suZGVsZXRlZF9hdCkuZ2V0VGltZSgpIDogRGF0ZS5ub3coKTtcbiAgICAgIGNvbnN0IGV4cGlyZUF0ID0gZGVsZXRlZEF0ICsgVEFTS19SRUNZQ0xFX1JFVEVOVElPTl9EQVlTICogMjQgKiA2MCAqIDYwICogMTAwMDtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ01zID0gTWF0aC5tYXgoZXhwaXJlQXQgLSBEYXRlLm5vdygpLCAwKTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ0RheXMgPSBNYXRoLmNlaWwocmVtYWluaW5nTXMgLyAoMjQgKiA2MCAqIDYwICogMTAwMCkpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi50YXNrLFxuICAgICAgICByZW1haW5pbmdEYXlzLFxuICAgICAgfTtcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHBheWxvYWQpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5wb3N0KCcvYmF0Y2gtZGVsZXRlJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGlmICghZW5zdXJlTWFpbkFkbWluKHJlcS51c2VyKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAn5peg5p2D5om56YeP5Yig6Zmk5Lu75YqhJyB9KTtcbiAgfVxuXG4gIGNvbnN0IGlkczogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KHJlcS5ib2R5Py5pZHMpXG4gICAgPyByZXEuYm9keS5pZHMuZmlsdGVyKChpZDogdW5rbm93bik6IGlkIGlzIHN0cmluZyA9PiB0eXBlb2YgaWQgPT09ICdzdHJpbmcnICYmIGlkLnRyaW0oKS5sZW5ndGggPiAwKVxuICAgIDogW107XG4gIGNvbnN0IHVuaXF1ZUlkcyA9IEFycmF5LmZyb20obmV3IFNldChpZHMpKTtcblxuICBpZiAodW5pcXVlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAn6K+36YCJ5oup6KaB5Yig6Zmk55qE5Lu75YqhJyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgZGVsZXRlZElkczogc3RyaW5nW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgaWQgb2YgdW5pcXVlSWRzKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzb2Z0RGVsZXRlVGFzayhpZCwgcmVxLnVzZXIpO1xuICAgICAgaWYgKCdlcnJvcicgaW4gcmVzdWx0KSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKHJlc3VsdC5zdGF0dXMgfHwgNTAwKS5qc29uKHsgZXJyb3I6IHJlc3VsdC5lcnJvciB9KTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZWRJZHMucHVzaChpZCk7XG4gICAgfVxuXG4gICAgbG9nQWRtaW5BY3Rpb24oXG4gICAgICByZXEudXNlcixcbiAgICAgICd0YXNrX2JhdGNoX2RlbGV0ZScsXG4gICAgICBg5om56YeP5Yig6Zmk5LqGICR7ZGVsZXRlZElkcy5sZW5ndGh9IOS4quS7u+WKoWAsXG4gICAgICBkZWxldGVkSWRzLmpvaW4oJywnKVxuICAgICk7XG5cbiAgICByZXMuanNvbih7XG4gICAgICBtZXNzYWdlOiBg5om56YeP5Yig6Zmk5oiQ5Yqf77yM5YWx5Yig6ZmkICR7ZGVsZXRlZElkcy5sZW5ndGh9IOS4quS7u+WKoWAsXG4gICAgICBkZWxldGVkSWRzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5nZXQoJy86aWQnLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCB0YXNrID0gYXdhaXQgZ2V0QXN5bmM8VGFza1Jvdz4oYFNFTEVDVCAqIEZST00gdGFza3MgV0hFUkUgaWQgPSA/IEFORCAke2FjdGl2ZVRhc2tDbGF1c2V9YCwgW3JlcS5wYXJhbXMuaWRdKTtcbiAgICBpZiAoIXRhc2spIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAn5Lu75Yqh5LiN5a2Y5ZyoJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBbY2xhaW1zLCBzdWJtaXNzaW9ucywgYXBwcm92YWxzLCBwcm9ncmVzc0xvZ3NdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYWxsQXN5bmMoJ1NFTEVDVCAqIEZST00gY2xhaW1zIFdIRVJFIHRhc2tfaWQgPSA/IE9SREVSIEJZIGNsYWltZWRfYXQgREVTQycsIFtyZXEucGFyYW1zLmlkXSksXG4gICAgICBhbGxBc3luYygnU0VMRUNUICogRlJPTSBzdWJtaXNzaW9ucyBXSEVSRSB0YXNrX2lkID0gPyBPUkRFUiBCWSBjcmVhdGVkX2F0IERFU0MnLCBbcmVxLnBhcmFtcy5pZF0pLFxuICAgICAgYWxsQXN5bmMoJ1NFTEVDVCAqIEZST00gdGFza19hcHByb3ZhbHMgV0hFUkUgdGFza19pZCA9ID8gT1JERVIgQlkgY3JlYXRlZF9hdCBERVNDJywgW3JlcS5wYXJhbXMuaWRdKSxcbiAgICAgIGFsbEFzeW5jPFRhc2tQcm9ncmVzc1Jvdz4oJ1NFTEVDVCAqIEZST00gdGFza19wcm9ncmVzc19sb2dzIFdIRVJFIHRhc2tfaWQgPSA/IE9SREVSIEJZIGNyZWF0ZWRfYXQgREVTQycsIFtyZXEucGFyYW1zLmlkXSksXG4gICAgXSk7XG5cbiAgICBjb25zdCBsYXRlc3RQcm9ncmVzcyA9IHByb2dyZXNzTG9nc1swXTtcblxuICAgIHJlcy5qc29uKHtcbiAgICAgIC4uLnRhc2ssXG4gICAgICBjbGFpbXMsXG4gICAgICBzdWJtaXNzaW9ucyxcbiAgICAgIGFwcHJvdmFscyxcbiAgICAgIHByb2dyZXNzTG9ncyxcbiAgICAgIGxhdGVzdF9wcm9ncmVzczogbGF0ZXN0UHJvZ3Jlc3M/LnByb2dyZXNzID8/IG51bGwsXG4gICAgICBsYXRlc3RfcHJvZ3Jlc3NfZGVzY3JpcHRpb246IGxhdGVzdFByb2dyZXNzPy5kZXNjcmlwdGlvbiA/PyBudWxsLFxuICAgICAgbGF0ZXN0X3Byb2dyZXNzX3VwZGF0ZWRfYXQ6IGxhdGVzdFByb2dyZXNzPy5jcmVhdGVkX2F0ID8/IG51bGwsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLmdldCgnLzppZC9hcHByb3ZhbHMnLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKCFlbnN1cmVUYXNrT3BlcmF0aW9uc0FsbG93ZWQocmVxLnVzZXIpKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICfml6DmnYPmn6XnnIvlrqHmibnorrDlvZUnIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCBhcHByb3ZhbHMgPSBhd2FpdCBhbGxBc3luYygnU0VMRUNUICogRlJPTSB0YXNrX2FwcHJvdmFscyBXSEVSRSB0YXNrX2lkID0gPyBPUkRFUiBCWSBjcmVhdGVkX2F0IERFU0MnLCBbcmVxLnBhcmFtcy5pZF0pO1xuICAgIHJlcy5qc29uKGFwcHJvdmFscyk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLmdldCgnLzppZC9jbGFpbXMnLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKHJlcS51c2VyLnJvbGUgIT09ICdtYWluX2FkbWluJyAmJiByZXEudXNlci5yb2xlICE9PSAnYWRtaW4nKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICfml6DmnYPmn6XnnIvnlLPpooborrDlvZUnIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBwdXJnZUV4cGlyZWREZWxldGVkVGFza3MoKTtcbiAgICBjb25zdCBjbGFpbXMgPSBhd2FpdCBhbGxBc3luYygnU0VMRUNUICogRlJPTSBjbGFpbXMgV0hFUkUgdGFza19pZCA9ID8gT1JERVIgQlkgY2xhaW1lZF9hdCBERVNDJywgW3JlcS5wYXJhbXMuaWRdKTtcbiAgICByZXMuanNvbihjbGFpbXMpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5wb3N0KCcvJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGNvbnN0IHsgdGl0bGUsIGRlc2NyaXB0aW9uLCB0eXBlLCByZXdhcmQsIHJld2FyZF90eXBlLCByZXdhcmRfaXRlbSwgZGlmZmljdWx0eSwgZXhwZWN0ZWRfZGVhZGxpbmUsIHByaW9yaXR5IH0gPSByZXEuYm9keTtcblxuICBpZiAoIXRpdGxlIHx8ICFkaWZmaWN1bHR5IHx8ICFleHBlY3RlZF9kZWFkbGluZSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAn5qCH6aKY44CB6Zq+5bqm5ZKM5pyf5pyb5a6M5oiQ5pe26Ze05LiN6IO95Li656m6JyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgdGFza0lkID0gY3JlYXRlSWQoKTtcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgY29uc3QgdGFzayA9IHtcbiAgICAgIGlkOiB0YXNrSWQsXG4gICAgICB0aXRsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiB8fCAnJyxcbiAgICAgIHR5cGU6IHR5cGUgfHwgJ290aGVyJyxcbiAgICAgIHJld2FyZDogcGFyc2VJbnQocmV3YXJkLCAxMCkgfHwgMCxcbiAgICAgIHJld2FyZF90eXBlOiByZXdhcmRfdHlwZSB8fCAncG9pbnRzJyxcbiAgICAgIHJld2FyZF9pdGVtOiByZXdhcmRfaXRlbSB8fCBudWxsLFxuICAgICAgZGlmZmljdWx0eSxcbiAgICAgIGV4cGVjdGVkX2RlYWRsaW5lLFxuICAgICAgcHJpb3JpdHk6IHByaW9yaXR5IHx8ICdtZWRpdW0nLFxuICAgICAgcmF0aW5nOiAwLFxuICAgICAgc3RhdHVzOiAncGVuZGluZycsXG4gICAgICBzdWJtaXR0ZXJfaWQ6IHJlcS51c2VyLmlkLFxuICAgICAgc3VibWl0dGVyX25hbWU6IHJlcS51c2VyLm5hbWUsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgICB1cGRhdGVkX2F0OiBub3csXG4gICAgfTtcblxuICAgIGF3YWl0IHJ1bkFzeW5jKFxuICAgICAgYElOU0VSVCBJTlRPIHRhc2tzIChcbiAgICAgICAgaWQsIHRpdGxlLCBkZXNjcmlwdGlvbiwgdHlwZSwgcmV3YXJkLCByZXdhcmRfdHlwZSwgcmV3YXJkX2l0ZW0sIGRpZmZpY3VsdHksXG4gICAgICAgIGV4cGVjdGVkX2RlYWRsaW5lLCBwcmlvcml0eSwgcmF0aW5nLCBzdGF0dXMsIHN1Ym1pdHRlcl9pZCwgc3VibWl0dGVyX25hbWUsXG4gICAgICAgIGNyZWF0ZWRfYXQsIHVwZGF0ZWRfYXQsIGlzX2RlbGV0ZWRcbiAgICAgICkgVkFMVUVTICg/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCAwKWAsXG4gICAgICBbXG4gICAgICAgIHRhc2suaWQsXG4gICAgICAgIHRhc2sudGl0bGUsXG4gICAgICAgIHRhc2suZGVzY3JpcHRpb24sXG4gICAgICAgIHRhc2sudHlwZSxcbiAgICAgICAgdGFzay5yZXdhcmQsXG4gICAgICAgIHRhc2sucmV3YXJkX3R5cGUsXG4gICAgICAgIHRhc2sucmV3YXJkX2l0ZW0sXG4gICAgICAgIHRhc2suZGlmZmljdWx0eSxcbiAgICAgICAgdGFzay5leHBlY3RlZF9kZWFkbGluZSxcbiAgICAgICAgdGFzay5wcmlvcml0eSxcbiAgICAgICAgdGFzay5yYXRpbmcsXG4gICAgICAgIHRhc2suc3RhdHVzLFxuICAgICAgICB0YXNrLnN1Ym1pdHRlcl9pZCxcbiAgICAgICAgdGFzay5zdWJtaXR0ZXJfbmFtZSxcbiAgICAgICAgdGFzay5jcmVhdGVkX2F0LFxuICAgICAgICB0YXNrLnVwZGF0ZWRfYXQsXG4gICAgICBdXG4gICAgKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHRhc2spO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5wdXQoJy86aWQvcmV2aWV3JywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGlmICghZW5zdXJlVGFza09wZXJhdGlvbnNBbGxvd2VkKHJlcS51c2VyKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAn5peg5p2D5a6h5qC45Lu75YqhJyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgdGFzayA9IGF3YWl0IGdldEFzeW5jPFRhc2tSb3c+KGBTRUxFQ1QgKiBGUk9NIHRhc2tzIFdIRVJFIGlkID0gPyBBTkQgJHthY3RpdmVUYXNrQ2xhdXNlfWAsIFtyZXEucGFyYW1zLmlkXSk7XG4gICAgaWYgKCF0YXNrKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ+S7u+WKoeS4jeWtmOWcqCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhcHByb3ZlZCwgY29tbWVudCwgcmF0aW5ncyB9ID0gcmVxLmJvZHk7XG4gICAgY29uc3Qgb2xkU3RhdHVzID0gdGFzay5zdGF0dXM7XG4gICAgY29uc3QgbmV3U3RhdHVzID0gYXBwcm92ZWQgPyAncHVibGlzaGVkJyA6ICdjYW5jZWxsZWQnO1xuICAgIGNvbnN0IGFjdGlvbiA9IGFwcHJvdmVkID8gJ2FwcHJvdmUnIDogJ3JlamVjdCc7XG4gICAgY29uc3QgdG90YWxSYXRpbmcgPSBidWlsZFJhdGluZ3NUb3RhbChyYXRpbmdzKTtcbiAgICBjb25zdCBhcHByb3ZhbElkID0gY3JlYXRlSWQoKTtcblxuICAgIGlmIChhcHByb3ZlZCkge1xuICAgICAgY29uc3QgdGFza05vID0gYXdhaXQgZ2VuZXJhdGVUYXNrTm8oKTtcbiAgICAgIGF3YWl0IHJ1bkFzeW5jKFxuICAgICAgICBgVVBEQVRFIHRhc2tzXG4gICAgICAgICBTRVQgc3RhdHVzID0gPywgcmF0aW5nID0gPywgcmV2aWV3X2NvbW1lbnQgPSA/LCByYXRpbmdzID0gPywgdGFza19ubyA9ID8sIHVwZGF0ZWRfYXQgPSA/XG4gICAgICAgICBXSEVSRSBpZCA9ID9gLFxuICAgICAgICBbJ3B1Ymxpc2hlZCcsIHRvdGFsUmF0aW5nIHx8IDEsIGNvbW1lbnQgfHwgJycsIHJhdGluZ3MgfHwgbnVsbCwgdGFza05vLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksIHJlcS5wYXJhbXMuaWRdXG4gICAgICApO1xuXG4gICAgICBhd2FpdCBydW5Bc3luYyhcbiAgICAgICAgJ0lOU0VSVCBJTlRPIHRhc2tfYXBwcm92YWxzIChpZCwgdGFza19pZCwgdGFza19ubywgYXBwcm92ZXJfaWQsIGFwcHJvdmVyX25hbWUsIGFwcHJvdmVyX3JvbGUsIGFjdGlvbiwgb2xkX3N0YXR1cywgbmV3X3N0YXR1cywgY29tbWVudCwgcmF0aW5ncykgVkFMVUVTICg/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/LCA/KScsXG4gICAgICAgIFthcHByb3ZhbElkLCByZXEucGFyYW1zLmlkLCB0YXNrTm8sIHJlcS51c2VyLmlkLCByZXEudXNlci5uYW1lLCByZXEudXNlci5yb2xlLCBhY3Rpb24sIG9sZFN0YXR1cywgbmV3U3RhdHVzLCBjb21tZW50IHx8ICcnLCByYXRpbmdzIHx8IG51bGxdXG4gICAgICApO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oeyBtZXNzYWdlOiAn5Lu75Yqh5bey5Y+R5biDJywgdGFza05vIH0pO1xuICAgIH1cblxuICAgIGF3YWl0IHJ1bkFzeW5jKFxuICAgICAgJ1VQREFURSB0YXNrcyBTRVQgc3RhdHVzID0gPywgcmF0aW5nID0gMCwgcmV2aWV3X2NvbW1lbnQgPSA/LCByYXRpbmdzID0gTlVMTCwgdXBkYXRlZF9hdCA9ID8gV0hFUkUgaWQgPSA/JyxcbiAgICAgIFsnY2FuY2VsbGVkJywgY29tbWVudCB8fCAnJywgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLCByZXEucGFyYW1zLmlkXVxuICAgICk7XG5cbiAgICBhd2FpdCBydW5Bc3luYyhcbiAgICAgICdJTlNFUlQgSU5UTyB0YXNrX2FwcHJvdmFscyAoaWQsIHRhc2tfaWQsIHRhc2tfbm8sIGFwcHJvdmVyX2lkLCBhcHByb3Zlcl9uYW1lLCBhcHByb3Zlcl9yb2xlLCBhY3Rpb24sIG9sZF9zdGF0dXMsIG5ld19zdGF0dXMsIGNvbW1lbnQsIHJhdGluZ3MpIFZBTFVFUyAoPywgPywgPywgPywgPywgPywgPywgPywgPywgPywgPyknLFxuICAgICAgW2FwcHJvdmFsSWQsIHJlcS5wYXJhbXMuaWQsIHRhc2sudGFza19ubyB8fCBudWxsLCByZXEudXNlci5pZCwgcmVxLnVzZXIubmFtZSwgcmVxLnVzZXIucm9sZSwgYWN0aW9uLCBvbGRTdGF0dXMsIG5ld1N0YXR1cywgY29tbWVudCB8fCAnJywgbnVsbF1cbiAgICApO1xuXG4gICAgYXdhaXQgcnVuQXN5bmMoXG4gICAgICAnSU5TRVJUIElOVE8gbm90aWZpY2F0aW9ucyAoaWQsIHVzZXJfaWQsIHRhc2tfaWQsIHR5cGUsIHRpdGxlLCBjb250ZW50KSBWQUxVRVMgKD8sID8sID8sID8sID8sID8pJyxcbiAgICAgIFtcbiAgICAgICAgY3JlYXRlSWQoKSxcbiAgICAgICAgdGFzay5zdWJtaXR0ZXJfaWQsXG4gICAgICAgIHRhc2suaWQsXG4gICAgICAgICd0YXNrX3JlamVjdGVkJyxcbiAgICAgICAgJ+S7u+WKoeWuoeaguOacqumAmui/hycsXG4gICAgICAgIGNvbW1lbnQgfHwgJ+aCqOeahOS7u+WKoeacqumAmui/h+WuoeaguO+8jOivt+iBlOezu+euoeeQhuWRmOS6huino+ivpuaDheOAgicsXG4gICAgICBdXG4gICAgKTtcblxuICAgIHJlcy5qc29uKHsgbWVzc2FnZTogJ+S7u+WKoeW3suaLkue7nScgfSk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLnBvc3QoJy86aWQvY2xhaW0nLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0YXNrID0gYXdhaXQgZ2V0QXN5bmM8VGFza1Jvdz4oYFNFTEVDVCAqIEZST00gdGFza3MgV0hFUkUgaWQgPSA/IEFORCAke2FjdGl2ZVRhc2tDbGF1c2V9YCwgW3JlcS5wYXJhbXMuaWRdKTtcbiAgICBpZiAoIXRhc2spIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAn5Lu75Yqh5LiN5a2Y5ZyoJyB9KTtcbiAgICB9XG5cbiAgICBpZiAodGFzay5zdGF0dXMgIT09ICdwdWJsaXNoZWQnICYmIHRhc2suc3RhdHVzICE9PSAnY2xhaW1lZCcpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiAn5Lu75Yqh5b2T5YmN5LiN5Y+v55Sz6aKGJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZ0NsYWltID0gYXdhaXQgZ2V0QXN5bmMoJ1NFTEVDVCAqIEZST00gY2xhaW1zIFdIRVJFIHRhc2tfaWQgPSA/IEFORCB1c2VyX2lkID0gPycsIFtyZXEucGFyYW1zLmlkLCByZXEudXNlci5pZF0pO1xuICAgIGlmIChleGlzdGluZ0NsYWltKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ+aCqOW3sue7j+eUs+mihui/h+i/meS4quS7u+WKoScgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2xhaW1JZCA9IGNyZWF0ZUlkKCk7XG4gICAgYXdhaXQgcnVuQXN5bmMoXG4gICAgICAnSU5TRVJUIElOVE8gY2xhaW1zIChpZCwgdGFza19pZCwgdXNlcl9pZCwgdXNlcl9uYW1lLCBzdGF0dXMpIFZBTFVFUyAoPywgPywgPywgPywgPyknLFxuICAgICAgW2NsYWltSWQsIHJlcS5wYXJhbXMuaWQsIHJlcS51c2VyLmlkLCByZXEudXNlci5uYW1lLCAncGVuZGluZyddXG4gICAgKTtcblxuICAgIGlmICh0YXNrLnN0YXR1cyA9PT0gJ3B1Ymxpc2hlZCcpIHtcbiAgICAgIGF3YWl0IHJ1bkFzeW5jKCdVUERBVEUgdGFza3MgU0VUIHN0YXR1cyA9ID8sIHVwZGF0ZWRfYXQgPSA/IFdIRVJFIGlkID0gPycsIFsnY2xhaW1lZCcsIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwgcmVxLnBhcmFtcy5pZF0pO1xuICAgIH1cblxuICAgIGNvbnN0IGFkbWlucyA9IGF3YWl0IGFsbEFzeW5jPHsgaWQ6IHN0cmluZyB9PignU0VMRUNUIGlkIEZST00gdXNlcnMgV0hFUkUgcm9sZSBJTiAoXCJtYWluX2FkbWluXCIsIFwiYWRtaW5cIiknKTtcbiAgICBmb3IgKGNvbnN0IGFkbWluIG9mIGFkbWlucykge1xuICAgICAgYXdhaXQgcnVuQXN5bmMoXG4gICAgICAgICdJTlNFUlQgSU5UTyBub3RpZmljYXRpb25zIChpZCwgdXNlcl9pZCwgdGFza19pZCwgdHlwZSwgdGl0bGUsIGNvbnRlbnQpIFZBTFVFUyAoPywgPywgPywgPywgPywgPyknLFxuICAgICAgICBbY3JlYXRlSWQoKSwgYWRtaW4uaWQsIHJlcS5wYXJhbXMuaWQsICd0YXNrX2NsYWltZWQnLCAn5paw5Lu75Yqh55Sz6aKGJywgYOeUqOaItyAke3JlcS51c2VyLm5hbWV9IOeUs+mihuS6huS7u+WKoe+8miR7dGFzay50aXRsZX1gXVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IG1lc3NhZ2U6ICfnlLPpoobmiJDlip8nLCBpZDogY2xhaW1JZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIucHV0KCcvOmlkL2Fzc2lnbicsIGF1dGhlbnRpY2F0ZVRva2VuLCBhc3luYyAocmVxOiBhbnksIHJlcykgPT4ge1xuICBpZiAoIWVuc3VyZVRhc2tPcGVyYXRpb25zQWxsb3dlZChyZXEudXNlcikpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ+aXoOadg+WIhumFjeS7u+WKoScgfSk7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHRhc2sgPSBhd2FpdCBnZXRBc3luYzxUYXNrUm93PihgU0VMRUNUICogRlJPTSB0YXNrcyBXSEVSRSBpZCA9ID8gQU5EICR7YWN0aXZlVGFza0NsYXVzZX1gLCBbcmVxLnBhcmFtcy5pZF0pO1xuICAgIGlmICghdGFzaykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICfku7vliqHkuI3lrZjlnKgnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgY2xhaW1JZCB9ID0gcmVxLmJvZHk7XG4gICAgY29uc3QgY2xhaW0gPSBhd2FpdCBnZXRBc3luYzxhbnk+KCdTRUxFQ1QgKiBGUk9NIGNsYWltcyBXSEVSRSBpZCA9ID8nLCBbY2xhaW1JZF0pO1xuICAgIGlmICghY2xhaW0pIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAn55Sz6aKG6K6w5b2V5LiN5a2Y5ZyoJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBhc3NpZ25lZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGF3YWl0IHJ1bkFzeW5jKFxuICAgICAgJ1VQREFURSB0YXNrcyBTRVQgc3RhdHVzID0gPywgYXNzaWduZWVfaWQgPSA/LCBhc3NpZ25lZV9uYW1lID0gPywgYXNzaWduZWRfYXQgPSA/LCB1cGRhdGVkX2F0ID0gPyBXSEVSRSBpZCA9ID8nLFxuICAgICAgWydhc3NpZ25lZCcsIGNsYWltLnVzZXJfaWQsIGNsYWltLnVzZXJfbmFtZSwgYXNzaWduZWRBdCwgYXNzaWduZWRBdCwgcmVxLnBhcmFtcy5pZF1cbiAgICApO1xuICAgIGF3YWl0IHJ1bkFzeW5jKCdVUERBVEUgY2xhaW1zIFNFVCBzdGF0dXMgPSA/IFdIRVJFIGlkID0gPycsIFsnYXNzaWduZWQnLCBjbGFpbUlkXSk7XG5cbiAgICBhd2FpdCBydW5Bc3luYyhcbiAgICAgICdJTlNFUlQgSU5UTyBub3RpZmljYXRpb25zIChpZCwgdXNlcl9pZCwgdGFza19pZCwgdHlwZSwgdGl0bGUsIGNvbnRlbnQpIFZBTFVFUyAoPywgPywgPywgPywgPywgPyknLFxuICAgICAgW2NyZWF0ZUlkKCksIGNsYWltLnVzZXJfaWQsIHJlcS5wYXJhbXMuaWQsICd0YXNrX2Fzc2lnbmVkJywgJ+S7u+WKoeW3suWIhumFjScsICfmgqjlt7LooqvliIbphY3liLDkuIDkuKrku7vliqHvvIzor7fmjInml7blrozmiJDjgIInXVxuICAgICk7XG5cbiAgICBsb2dBZG1pbkFjdGlvbihyZXEudXNlciwgJ3Rhc2tfYXNzaWduJywgYOWwhuS7u+WKoeOAiiR7dGFzay50aXRsZX3jgIvliIbphY3nu5kgJHtjbGFpbS51c2VyX25hbWV9YCwgcmVxLnBhcmFtcy5pZCk7XG4gICAgcmVzLmpzb24oeyBtZXNzYWdlOiAn5YiG6YWN5oiQ5YqfJyB9KTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIucHV0KCcvOmlkL3JlaXNzdWUnLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKHJlcS51c2VyLnJvbGUgIT09ICdtYWluX2FkbWluJyAmJiByZXEudXNlci5yb2xlICE9PSAnYWRtaW4nKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICfml6DmnYPph43mlrDlj5HluIPku7vliqEnIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB0YXNrID0gYXdhaXQgZ2V0QXN5bmM8VGFza1Jvdz4oYFNFTEVDVCAqIEZST00gdGFza3MgV0hFUkUgaWQgPSA/IEFORCAke2FjdGl2ZVRhc2tDbGF1c2V9YCwgW3JlcS5wYXJhbXMuaWRdKTtcbiAgICBpZiAoIXRhc2spIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAn5Lu75Yqh5LiN5a2Y5ZyoJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGV4cGVjdGVkX2RlYWRsaW5lIH0gPSByZXEuYm9keTtcbiAgICBhd2FpdCBydW5Bc3luYyhcbiAgICAgICdVUERBVEUgdGFza3MgU0VUIHN0YXR1cyA9ID8sIGV4cGVjdGVkX2RlYWRsaW5lID0gQ09BTEVTQ0UoPywgZXhwZWN0ZWRfZGVhZGxpbmUpLCB1cGRhdGVkX2F0ID0gPyBXSEVSRSBpZCA9ID8nLFxuICAgICAgWydwdWJsaXNoZWQnLCBleHBlY3RlZF9kZWFkbGluZSB8fCBudWxsLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksIHJlcS5wYXJhbXMuaWRdXG4gICAgKTtcblxuICAgIHJlcy5qc29uKHsgbWVzc2FnZTogJ+S7u+WKoeW3sumHjeaWsOWPkeW4gycgfSk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xuICB9XG59KTtcblxucm91dGVyLnB1dCgnLzppZC9wdWJsaWNpdHknLCBhdXRoZW50aWNhdGVUb2tlbiwgYXN5bmMgKHJlcTogYW55LCByZXMpID0+IHtcbiAgaWYgKCFlbnN1cmVBZG1pbkNvbnRyb2xzQWxsb3dlZChyZXEudXNlcikpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ+aXoOadg+iuvue9ruS7u+WKoeWFrOekuueKtuaAgScgfSk7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHRhc2sgPSBhd2FpdCBnZXRBc3luYzxUYXNrUm93PihgU0VMRUNUICogRlJPTSB0YXNrcyBXSEVSRSBpZCA9ID8gQU5EICR7YWN0aXZlVGFza0NsYXVzZX1gLCBbcmVxLnBhcmFtcy5pZF0pO1xuICAgIGlmICghdGFzaykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICfku7vliqHkuI3lrZjlnKgnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlzUHVibGljaXplZCA9IHJlcS5ib2R5Py5pc1B1YmxpY2l6ZWQgPyAxIDogMDtcblxuICAgIGlmIChpc1B1YmxpY2l6ZWQgPT09IDEgJiYgdGFzay5zdGF0dXMgIT09ICdhc3NpZ25lZCcgJiYgdGFzay5zdGF0dXMgIT09ICdjb21wbGV0ZWQnKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ+S7heW3suWIhumFjeaIluW3suWujOaIkOeahOS7u+WKoeWPr+S7peWFrOekuicgfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgcnVuQXN5bmMoJ1VQREFURSB0YXNrcyBTRVQgaXNfcHVibGljaXplZCA9ID8sIHVwZGF0ZWRfYXQgPSA/IFdIRVJFIGlkID0gPycsIFtcbiAgICAgIGlzUHVibGljaXplZCxcbiAgICAgIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHJlcS5wYXJhbXMuaWQsXG4gICAgXSk7XG5cbiAgICBsb2dBZG1pbkFjdGlvbihcbiAgICAgIHJlcS51c2VyLFxuICAgICAgJ3Rhc2tfcHVibGljaXR5X3VwZGF0ZScsXG4gICAgICBgJHtpc1B1YmxpY2l6ZWQgPT09IDEgPyAn5bCG5Lu75Yqh6K6+5Li65YWs56S6JyA6ICflsIbku7vliqHorr7kuLrkuI3lhaznpLonfe+8miR7dGFzay50aXRsZX1gLFxuICAgICAgcmVxLnBhcmFtcy5pZFxuICAgICk7XG5cbiAgICByZXMuanNvbih7XG4gICAgICBtZXNzYWdlOiBpc1B1YmxpY2l6ZWQgPT09IDEgPyAn5Lu75Yqh5bey6K6+5Li65YWs56S6JyA6ICfku7vliqHlt7Lorr7kuLrkuI3lhaznpLonLFxuICAgICAgaXNfcHVibGljaXplZDogaXNQdWJsaWNpemVkLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbnJvdXRlci5wb3N0KCcvOmlkL3Byb2dyZXNzJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdGFzayA9IGF3YWl0IGdldEFzeW5jPFRhc2tSb3c+KGBTRUxFQ1QgKiBGUk9NIHRhc2tzIFdIRVJFIGlkID0gPyBBTkQgJHthY3RpdmVUYXNrQ2xhdXNlfWAsIFtyZXEucGFyYW1zLmlkXSk7XG4gICAgaWYgKCF0YXNrKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogJ+S7u+WKoeS4jeWtmOWcqCcgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRhc2suYXNzaWduZWVfaWQgIT09IHJlcS51c2VyLmlkKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogJ+WPquacieW9k+WJjeS7u+WKoeaJv+aOpeaWueWPr+S7peeZu+iusOi/m+W6picgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRhc2suc3RhdHVzICE9PSAnYXNzaWduZWQnICYmIHRhc2suc3RhdHVzICE9PSAnY29tcGxldGVkJykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICflvZPliY3ku7vliqHnirbmgIHkuI3mlK/mjIHnmbvorrDov5vluqYnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHJhd1Byb2dyZXNzID0gTnVtYmVyKHJlcS5ib2R5Py5wcm9ncmVzcyk7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSB0eXBlb2YgcmVxLmJvZHk/LmRlc2NyaXB0aW9uID09PSAnc3RyaW5nJyA/IHJlcS5ib2R5LmRlc2NyaXB0aW9uLnRyaW0oKSA6ICcnO1xuXG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUocmF3UHJvZ3Jlc3MpIHx8IHJhd1Byb2dyZXNzIDwgMCB8fCByYXdQcm9ncmVzcyA+IDEwMCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICfku7vliqHov5vluqbpnIDloavlhpkgMCDliLAgMTAwIOS5i+mXtOeahOeZvuWIhuavlCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBNYXRoLnJvdW5kKHJhd1Byb2dyZXNzKTtcbiAgICBjb25zdCBsYXRlc3RQcm9ncmVzc0xvZyA9IGF3YWl0IGdldEFzeW5jPFRhc2tQcm9ncmVzc1Jvdz4oXG4gICAgICAnU0VMRUNUICogRlJPTSB0YXNrX3Byb2dyZXNzX2xvZ3MgV0hFUkUgdGFza19pZCA9ID8gT1JERVIgQlkgY3JlYXRlZF9hdCBERVNDIExJTUlUIDEnLFxuICAgICAgW3Rhc2suaWRdXG4gICAgKTtcblxuICAgIGlmIChsYXRlc3RQcm9ncmVzc0xvZyAmJiBwcm9ncmVzcyA8PSBsYXRlc3RQcm9ncmVzc0xvZy5wcm9ncmVzcykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGDmnKzmrKHku7vliqHov5vluqblv4XpobvlpKfkuo7kuIrkuIDmrKHnmbvorrDnmoQgJHtsYXRlc3RQcm9ncmVzc0xvZy5wcm9ncmVzc30lYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHByb2dyZXNzSWQgPSBjcmVhdGVJZCgpO1xuICAgIGNvbnN0IGNyZWF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgIGF3YWl0IHJ1bkFzeW5jKFxuICAgICAgYElOU0VSVCBJTlRPIHRhc2tfcHJvZ3Jlc3NfbG9ncyAoaWQsIHRhc2tfaWQsIHByb2dyZXNzLCBkZXNjcmlwdGlvbiwgdXBkYXRlcl9pZCwgdXBkYXRlcl9uYW1lLCBjcmVhdGVkX2F0KVxuICAgICAgIFZBTFVFUyAoPywgPywgPywgPywgPywgPywgPylgLFxuICAgICAgW3Byb2dyZXNzSWQsIHRhc2suaWQsIHByb2dyZXNzLCBkZXNjcmlwdGlvbiB8fCBudWxsLCByZXEudXNlci5pZCwgcmVxLnVzZXIubmFtZSwgY3JlYXRlZEF0XVxuICAgICk7XG5cbiAgICBhd2FpdCBydW5Bc3luYygnVVBEQVRFIHRhc2tzIFNFVCB1cGRhdGVkX2F0ID0gPyBXSEVSRSBpZCA9ID8nLCBbY3JlYXRlZEF0LCB0YXNrLmlkXSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7XG4gICAgICBpZDogcHJvZ3Jlc3NJZCxcbiAgICAgIHRhc2tfaWQ6IHRhc2suaWQsXG4gICAgICBwcm9ncmVzcyxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgdXBkYXRlcl9pZDogcmVxLnVzZXIuaWQsXG4gICAgICB1cGRhdGVyX25hbWU6IHJlcS51c2VyLm5hbWUsXG4gICAgICBjcmVhdGVkX2F0OiBjcmVhdGVkQXQsXG4gICAgICBtZXNzYWdlOiAn5Lu75Yqh6L+b5bqm55m76K6w5oiQ5YqfJyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gIH1cbn0pO1xuXG5yb3V0ZXIuZGVsZXRlKCcvOmlkJywgYXV0aGVudGljYXRlVG9rZW4sIGFzeW5jIChyZXE6IGFueSwgcmVzKSA9PiB7XG4gIGlmICghZW5zdXJlTWFpbkFkbWluKHJlcS51c2VyKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMykuanNvbih7IGVycm9yOiAn5peg5p2D5Yig6Zmk5Lu75YqhJyB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc29mdERlbGV0ZVRhc2socmVxLnBhcmFtcy5pZCwgcmVxLnVzZXIpO1xuICAgIGlmICgnZXJyb3InIGluIHJlc3VsdCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzdWx0LnN0YXR1cyB8fCA1MDApLmpzb24oeyBlcnJvcjogcmVzdWx0LmVycm9yIH0pO1xuICAgIH1cbiAgICByZXMuanNvbihyZXN1bHQpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IHJvdXRlcjtcbiJdfQ==