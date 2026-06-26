import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminLog,
  Task,
  User,
  batchDeleteTasks,
  batchDeleteUsers,
  createAdminUser,
  deleteTask,
  deleteUser,
  exportUsers,
  getAdminLogs,
  getDeletedTasks,
  getPendingTasks,
  getReviewedTasks,
  getUsers,
  importUsers,
  resetUserPassword,
  setTaskPublicity,
  updateUserDisabled,
  updateUserRole,
} from '../api/api';
import { useAuthStore } from '../store/authStore';
import PaginationControls from '../components/PaginationControls';
import {
  Archive,
  ArrowLeft,
  CheckSquare,
  Clock,
  Download,
  FileText,
  KeyRound,
  Shield,
  Square,
  Trash2,
  Upload,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { usePagination } from '../hooks/usePagination';

const DEFAULT_RESET_PASSWORD = '123456';

const roleLabels: Record<string, string> = {
  main_admin: '主管理员',
  admin: '管理员',
  expert: '技术专家',
  user: '普通用户',
};

const baseRoleOptions = [
  { value: 'user', label: '普通用户' },
  { value: 'expert', label: '技术专家' },
  { value: 'admin', label: '管理员' },
  { value: 'main_admin', label: '主管理员' },
];

const actionTypeLabels: Record<string, string> = {
  user_create: '新增用户',
  user_role_change: '用户角色变更',
  task_assign: '任务分配',
  submission_review: '结果审核',
  user_password_reset: '密码重置',
  user_disable: '用户禁用',
  user_enable: '用户启用',
  user_delete: '账号删除',
  user_batch_delete: '批量删除账号',
  task_delete: '任务删除',
  task_batch_delete: '批量删除任务',
  task_publicity_update: '任务公示设置',
};

const taskStatusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  claimed: '已申领',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '已驳回',
};

type ActiveTab = 'users' | 'tasks' | 'logs';
type TaskView = 'active' | 'recycle';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [taskView, setTaskView] = useState<TaskView>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recycledTasks, setRecycledTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [publicityTaskId, setPublicityTaskId] = useState<string | null>(null);
  const [batchDeletingUsers, setBatchDeletingUsers] = useState(false);
  const [batchDeletingTasksState, setBatchDeletingTasksState] = useState(false);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [importingUsers, setImportingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'user',
  });
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const isMainAdmin = user?.role === 'main_admin';
  const canViewPage = user?.role === 'main_admin' || user?.role === 'admin';
  const creatableRoleOptions = isMainAdmin
    ? baseRoleOptions
    : baseRoleOptions.filter((option) => option.value !== 'main_admin');
  const usersPagination = usePagination(users, [activeTab, users.length]);
  const tasksPagination = usePagination(tasks, [activeTab, taskView, tasks.length]);
  const recycledTasksPagination = usePagination(recycledTasks, [activeTab, taskView, recycledTasks.length]);
  const logsPagination = usePagination(logs, [activeTab, logs.length]);

  useEffect(() => {
    if (!canViewPage) {
      navigate('/');
      return;
    }

    if (activeTab === 'users') {
      void fetchUsers();
    } else if (activeTab === 'tasks') {
      void fetchTasks();
    } else {
      void fetchLogs();
    }
  }, [activeTab, taskView, canViewPage, navigate]);

  const manageableUsers = useMemo(
    () => usersPagination.pagedItems.filter((item) => item.id !== user?.id),
    [usersPagination.pagedItems, user?.id]
  );
  const allSelectableUserIds = manageableUsers.map((item) => item.id);
  const allUsersSelected =
    allSelectableUserIds.length > 0 && allSelectableUserIds.every((id) => selectedUserIds.includes(id));
  const allTaskIds = tasksPagination.pagedItems.map((item) => item.id);
  const allTasksSelected = allTaskIds.length > 0 && allTaskIds.every((id) => selectedTaskIds.includes(id));

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      const safeUsers = Array.isArray(data) ? data : [];
      setUsers(safeUsers);
      setSelectedUserIds((current) => current.filter((id) => safeUsers.some((item) => item.id === id)));
    } catch {
      setUsers([]);
      setSelectedUserIds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      if (taskView === 'recycle' && isMainAdmin) {
        const recycleData = await getDeletedTasks();
        setRecycledTasks(Array.isArray(recycleData) ? recycleData : []);
        setTasks([]);
        setSelectedTaskIds([]);
      } else {
        const [pendingData, reviewedData] = await Promise.all([getPendingTasks(), getReviewedTasks()]);
        const pendingTasks = Array.isArray(pendingData) ? pendingData : [];
        const reviewedTasks = Array.isArray(reviewedData) ? reviewedData : [];
        const merged = [...pendingTasks, ...reviewedTasks];
        const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values()).sort(
          (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        setTasks(deduped);
        setRecycledTasks([]);
        setSelectedTaskIds((current) => current.filter((id) => deduped.some((item) => item.id === id)));
      }
    } catch {
      setTasks([]);
      setRecycledTasks([]);
      setSelectedTaskIds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAdminLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createUserForm.username.trim() || !createUserForm.name.trim() || !createUserForm.password.trim()) {
      window.alert('请完整填写用户名、花名和初始密码');
      return;
    }

    try {
      const result = await createAdminUser({
        username: createUserForm.username.trim(),
        name: createUserForm.name.trim(),
        password: createUserForm.password.trim(),
        role: createUserForm.role,
      });

      if (result.user) {
        setUsers((current) => [result.user, ...current]);
      }

      setCreateUserForm({
        username: '',
        name: '',
        password: '',
        role: 'user',
      });
      window.alert(result.message || '用户创建成功');
    } catch (error: any) {
      window.alert(error.message || '新增用户失败');
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      const blob = await exportUsers();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      window.alert(error.message || '导出用户失败');
    } finally {
      setExportingUsers(false);
    }
  };

  const handleImportUsers = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingUsers(true);
    try {
      const result = await importUsers(file);
      await fetchUsers();

      const summary = [
        result.message || '批量导入完成',
        result.skipped.length > 0 ? `跳过明细：\n${result.skipped.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      window.alert(summary);
    } catch (error: any) {
      window.alert(error.message || '批量导入用户失败');
    } finally {
      event.target.value = '';
      setImportingUsers(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers((current) => current.map((item) => (item.id === userId ? { ...item, role: newRole } : item)));
      setEditingUserId(null);
      window.alert('角色更新成功');
    } catch (error: any) {
      window.alert(error.message || '更新角色失败');
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    const confirmed = window.confirm(`确认将账号“${targetUser.username}”的密码重置为默认密码 ${DEFAULT_RESET_PASSWORD} 吗？`);
    if (!confirmed) return;

    setActionUserId(targetUser.id);
    try {
      const result = await resetUserPassword(targetUser.id);
      window.alert(`已重置密码，新密码为：${result.temporaryPassword || DEFAULT_RESET_PASSWORD}`);
    } catch (error: any) {
      window.alert(error.message || '重置密码失败');
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    const confirmed = window.confirm(`确认删除账号“${targetUser.username}”吗？删除后该账号将无法登录。`);
    if (!confirmed) return;

    setActionUserId(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      setUsers((current) => current.filter((item) => item.id !== targetUser.id));
      setSelectedUserIds((current) => current.filter((id) => id !== targetUser.id));
      window.alert('账号删除成功');
    } catch (error: any) {
      window.alert(error.message || '删除账号失败');
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleUserDisabled = async (targetUser: User) => {
    const nextDisabled = Number(targetUser.is_disabled || 0) !== 1;
    const confirmed = window.confirm(
      nextDisabled
        ? `确认禁用账号“${targetUser.username}”吗？禁用后该用户将无法登录，但历史记录会被保留。`
        : `确认启用账号“${targetUser.username}”吗？启用后该用户可重新登录。`
    );
    if (!confirmed) return;

    setActionUserId(targetUser.id);
    try {
      const result = await updateUserDisabled(targetUser.id, nextDisabled);
      const updatedUser = result.user;
      setUsers((current) =>
        current.map((item) =>
          item.id === targetUser.id
            ? {
                ...item,
                is_disabled: updatedUser?.is_disabled ?? (nextDisabled ? 1 : 0),
                disabled_at: updatedUser?.disabled_at ?? (nextDisabled ? new Date().toISOString() : null),
                disabled_by: updatedUser?.disabled_by ?? null,
                disabled_by_name: updatedUser?.disabled_by_name ?? null,
                updated_at: updatedUser?.updated_at ?? new Date().toISOString(),
              }
            : item
        )
      );
      window.alert(result.message || (nextDisabled ? '用户已禁用' : '用户已启用'));
    } catch (error: any) {
      window.alert(error.message || '更新用户状态失败');
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleUser = (targetUserId: string) => {
    setSelectedUserIds((current) =>
      current.includes(targetUserId) ? current.filter((id) => id !== targetUserId) : [...current, targetUserId]
    );
  };

  const handleToggleAllUsers = () => {
    setSelectedUserIds(allUsersSelected ? [] : allSelectableUserIds);
  };

  const handleBatchDeleteUsers = async () => {
    if (selectedUserIds.length === 0) {
      window.alert('请先选择要删除的账号');
      return;
    }

    const targetNames = users
      .filter((item) => selectedUserIds.includes(item.id))
      .map((item) => item.username)
      .join('、');

    const confirmed = window.confirm(`确认批量删除这 ${selectedUserIds.length} 个账号吗？\n${targetNames}`);
    if (!confirmed) return;

    setBatchDeletingUsers(true);
    try {
      const result = await batchDeleteUsers(selectedUserIds);
      const deletedIds: string[] = Array.isArray(result.deletedIds) ? result.deletedIds : selectedUserIds;
      setUsers((current) => current.filter((item) => !deletedIds.includes(item.id)));
      setSelectedUserIds([]);
      window.alert(result.message || '批量删除成功');
    } catch (error: any) {
      window.alert(error.message || '批量删除失败');
    } finally {
      setBatchDeletingUsers(false);
    }
  };

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  };

  const handleToggleAllTasks = () => {
    setSelectedTaskIds(allTasksSelected ? [] : allTaskIds);
  };

  const handleDeleteTask = async (task: Task) => {
    const confirmed = window.confirm(`确认删除任务“${task.title}”吗？删除后会进入回收站保存 7 天。`);
    if (!confirmed) return;

    setActionTaskId(task.id);
    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setSelectedTaskIds((current) => current.filter((id) => id !== task.id));
      window.alert('任务已移入回收站');
    } catch (error: any) {
      window.alert(error.message || '删除任务失败');
    } finally {
      setActionTaskId(null);
    }
  };

  const handleBatchDeleteTasks = async () => {
    if (selectedTaskIds.length === 0) {
      window.alert('请先选择要删除的任务');
      return;
    }

    const targetNames = tasks
      .filter((item) => selectedTaskIds.includes(item.id))
      .map((item) => item.title)
      .join('、');

    const confirmed = window.confirm(`确认批量删除这 ${selectedTaskIds.length} 个任务吗？\n${targetNames}`);
    if (!confirmed) return;

    setBatchDeletingTasksState(true);
    try {
      const result = await batchDeleteTasks(selectedTaskIds);
      const deletedIds: string[] = Array.isArray(result.deletedIds) ? result.deletedIds : selectedTaskIds;
      setTasks((current) => current.filter((item) => !deletedIds.includes(item.id)));
      setSelectedTaskIds([]);
      window.alert(result.message || '批量删除成功');
    } catch (error: any) {
      window.alert(error.message || '批量删除失败');
    } finally {
      setBatchDeletingTasksState(false);
    }
  };

  const handleSetTaskPublicity = async (task: Task, isPublicized: boolean) => {
    setPublicityTaskId(task.id);
    try {
      const result = await setTaskPublicity(task.id, isPublicized);
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, is_publicized: result.is_publicized ?? (isPublicized ? 1 : 0) } : item
        )
      );
      window.alert(result.message || (isPublicized ? '任务已设为公示' : '任务已取消公示'));
    } catch (error: any) {
      window.alert(error.message || '设置任务公示状态失败');
    } finally {
      setPublicityTaskId(null);
    }
  };

  const canPublishTask = (task: Task) => task.status === 'assigned' || task.status === 'completed';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!canViewPage) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
          <span>返回</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">后台管理</h1>
          <p className="mt-1 text-gray-500">管理系统账号、任务和后台操作日志</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'users' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>用户管理</span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'tasks' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>任务管理</span>
        </button>
        {isMainAdmin && (
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'logs' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>操作日志</span>
          </button>
        )}
      </div>

      {activeTab === 'tasks' && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setTaskView('active')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
              taskView === 'active' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>任务列表</span>
          </button>
          {isMainAdmin && (
            <button
              onClick={() => setTaskView('recycle')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                taskView === 'recycle' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Archive className="h-4 w-4" />
              <span>回收站</span>
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-800">新增用户</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={createUserForm.username}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, username: event.target.value }))}
                className="form-input"
                placeholder="用户名"
              />
              <input
                value={createUserForm.name}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, name: event.target.value }))}
                className="form-input"
                placeholder="花名"
              />
              <input
                type="password"
                value={createUserForm.password}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, password: event.target.value }))}
                className="form-input"
                placeholder="初始密码"
              />
              <select
                value={createUserForm.role}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, role: event.target.value }))}
                className="form-select"
              >
                {creatableRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => void handleCreateUser()} className="btn-primary">
                新增用户
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => void handleExportUsers()}
                disabled={exportingUsers}
                className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{exportingUsers ? '导出中...' : '导出用户'}</span>
              </button>
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importingUsers}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                <span>{importingUsers ? '导入中...' : '批量导入用户'}</span>
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleImportUsers(event)}
              />
              <p className="text-xs text-gray-500">导入文件请使用 CSV 格式，表头固定为 `username,name,password,role`</p>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="card py-12 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-gray-500">暂无用户</p>
            </div>
          ) : (
            <div className="space-y-4">
              {isMainAdmin && (
                <div className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    已选择 <span className="font-semibold text-gray-800">{selectedUserIds.length}</span> 个账号
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={handleToggleAllUsers} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800">
                      {allUsersSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      <span>{allUsersSelected ? '取消全选' : '全选可删除账号'}</span>
                    </button>
                    <button
                      onClick={() => void handleBatchDeleteUsers()}
                      disabled={batchDeletingUsers || selectedUserIds.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{batchDeletingUsers ? '批量删除中...' : '批量删除'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {isMainAdmin && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">选择</th>}
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">用户名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">花名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">注册时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {usersPagination.pagedItems.map((item) => {
                      const isSelf = item.id === user?.id;
                      const busy = actionUserId === item.id;
                      const selected = selectedUserIds.includes(item.id);
                      const adminCannotReset = !isMainAdmin && item.role === 'main_admin';

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {isMainAdmin && (
                            <td className="px-4 py-4">
                              {isSelf ? (
                                <span className="text-xs text-gray-400">当前账号</span>
                              ) : (
                                <button onClick={() => handleToggleUser(item.id)} className="text-gray-600 hover:text-primary-600">
                                  {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                </button>
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{item.username}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{item.name}</td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {isMainAdmin && editingUserId === item.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  value={item.role}
                                  onChange={(event) => void handleUpdateRole(item.id, event.target.value)}
                                  className="form-input py-2 text-sm"
                                >
                                  {baseRoleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button onClick={() => setEditingUserId(null)} className="text-sm text-gray-400 hover:text-gray-600">
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  item.role === 'main_admin' || item.role === 'admin'
                                    ? 'bg-purple-100 text-purple-700'
                                    : item.role === 'expert'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {roleLabels[item.role]}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                Number(item.is_disabled || 0) === 1
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {Number(item.is_disabled || 0) === 1 ? '已禁用' : '正常'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{formatDate(item.created_at)}</td>
                          <td className="px-6 py-4 text-sm">
                            {isSelf ? (
                              <span className="text-gray-400">当前账号</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-3">
                                {isMainAdmin && editingUserId !== item.id && (
                                  <button onClick={() => setEditingUserId(item.id)} className="text-primary-600 hover:text-primary-700">
                                    编辑角色
                                  </button>
                                )}
                                <button
                                  onClick={() => void handleResetPassword(item)}
                                  disabled={busy || adminCannotReset}
                                  className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 disabled:cursor-not-allowed disabled:text-amber-300"
                                >
                                  <KeyRound className="h-4 w-4" />
                                  <span>{busy ? '处理中...' : adminCannotReset ? '不可重置主管理员' : '重置密码'}</span>
                                </button>
                                <button
                                  onClick={() => void handleToggleUserDisabled(item)}
                                  disabled={busy || adminCannotReset}
                                  className={`inline-flex items-center gap-1 ${
                                    Number(item.is_disabled || 0) === 1
                                      ? 'text-emerald-600 hover:text-emerald-700'
                                      : 'text-red-600 hover:text-red-700'
                                  } disabled:cursor-not-allowed disabled:text-gray-300`}
                                >
                                  {Number(item.is_disabled || 0) === 1 ? (
                                    <UserCheck className="h-4 w-4" />
                                  ) : (
                                    <UserX className="h-4 w-4" />
                                  )}
                                  <span>{Number(item.is_disabled || 0) === 1 ? '启用用户' : '禁用用户'}</span>
                                </button>
                                {isMainAdmin && (
                                  <button
                                    onClick={() => void handleDeleteUser(item)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>删除账号</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
              <div className="px-6 py-4">
                <PaginationControls
                  page={usersPagination.page}
                  pageSize={usersPagination.pageSize}
                  totalItems={usersPagination.totalItems}
                  totalPages={usersPagination.totalPages}
                  onPageChange={usersPagination.setPage}
                  onPageSizeChange={usersPagination.setPageSize}
                />
              </div>
            </div>
          </div>
        )}
        </div>
      ) : activeTab === 'tasks' ? (
        taskView === 'recycle' && isMainAdmin ? (
          recycledTasks.length === 0 ? (
            <div className="card py-12 text-center">
              <Archive className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-gray-500">回收站暂无任务</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务发布方</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">删除人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">删除时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">剩余保留</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recycledTasksPagination.pagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.task_no || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.submitter_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.deleted_by_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.deleted_at)}</td>
                      <td className="px-6 py-4 text-sm text-amber-600">{item.remainingDays ?? 0} 天</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-4">
                <PaginationControls
                  page={recycledTasksPagination.page}
                  pageSize={recycledTasksPagination.pageSize}
                  totalItems={recycledTasksPagination.totalItems}
                  totalPages={recycledTasksPagination.totalPages}
                  onPageChange={recycledTasksPagination.setPage}
                  onPageSizeChange={recycledTasksPagination.setPageSize}
                />
              </div>
            </div>
          )
        ) : tasks.length === 0 ? (
          <div className="card py-12 text-center">
            <Trash2 className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-gray-500">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isMainAdmin && (
              <div className="card flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  已选择 <span className="font-semibold text-gray-800">{selectedTaskIds.length}</span> 个任务
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleToggleAllTasks} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800">
                    {allTasksSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    <span>{allTasksSelected ? '取消全选' : '全选当前任务'}</span>
                  </button>
                  <button
                    onClick={() => void handleBatchDeleteTasks()}
                    disabled={batchDeletingTasksState || selectedTaskIds.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{batchDeletingTasksState ? '批量删除中...' : '批量删除任务'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {isMainAdmin && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">选择</th>}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">任务发布方</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">公示状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">更新时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tasksPagination.pagedItems.map((item) => {
                    const deleteBusy = actionTaskId === item.id;
                    const publicityBusy = publicityTaskId === item.id;
                    const selected = selectedTaskIds.includes(item.id);
                    const isPublicized = Number(item.is_publicized || 0) === 1;
                    const allowPublish = canPublishTask(item);

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {isMainAdmin && (
                          <td className="px-4 py-4">
                            <button onClick={() => handleToggleTask(item.id)} className="text-gray-600 hover:text-primary-600">
                              {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                            </button>
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.task_no || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{taskStatusLabels[item.status] || item.status}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.submitter_name}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              isPublicized ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isPublicized ? '公示中' : '不公示'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.updated_at || item.created_at)}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => void handleSetTaskPublicity(item, !isPublicized)}
                              disabled={publicityBusy || (!isPublicized && !allowPublish)}
                              className={`inline-flex items-center gap-1 ${
                                isPublicized ? 'text-amber-600 hover:text-amber-700' : 'text-primary-600 hover:text-primary-700'
                              } disabled:cursor-not-allowed disabled:text-gray-300`}
                            >
                              <span>{publicityBusy ? '处理中...' : isPublicized ? '取消公示' : '设为公示'}</span>
                            </button>
                            {!allowPublish && !isPublicized && <span className="text-xs text-gray-400">待分配后可设置</span>}
                            {isMainAdmin && (
                              <button
                                onClick={() => void handleDeleteTask(item)}
                                disabled={deleteBusy}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>{deleteBusy ? '处理中...' : '删除任务'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-6 py-4">
                <PaginationControls
                  page={tasksPagination.page}
                  pageSize={tasksPagination.pageSize}
                  totalItems={tasksPagination.totalItems}
                  totalPages={tasksPagination.totalPages}
                  onPageChange={tasksPagination.setPage}
                  onPageSizeChange={tasksPagination.setPageSize}
                />
              </div>
            </div>
          </div>
        )
      ) : logs.length === 0 ? (
        <div className="card py-12 text-center">
          <Clock className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">暂无操作日志</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作人</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">操作详情</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logsPagination.pagedItems.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{actionTypeLabels[log.action_type] || log.action_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{log.admin_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{log.action_detail}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4">
            <PaginationControls
              page={logsPagination.page}
              pageSize={logsPagination.pageSize}
              totalItems={logsPagination.totalItems}
              totalPages={logsPagination.totalPages}
              onPageChange={logsPagination.setPage}
              onPageSizeChange={logsPagination.setPageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
}
