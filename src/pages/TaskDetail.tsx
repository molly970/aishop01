import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Gift,
  Send,
  Star,
  Trophy,
  User,
  Users,
  Users2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  assignTask,
  Claim,
  claimTask,
  createTaskProgress,
  getTaskById,
  Submission,
  Task,
  TaskProgressLog,
} from '../api/api';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';

const taskTypes: Record<string, string> = {
  ai_research: 'AI 研究',
  model_training: '模型训练',
  data_analysis: '数据处理',
  other: '内容生成',
  design: '设计创意',
  dev: '开发任务',
  misc: '其他',
};

const statusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  claimed: '待指派',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '已取消',
};

const difficultyLabels: Record<string, string> = {
  simple: '简单',
  medium: '中等',
  complex: '复杂',
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
};

const ProgressBar = ({ progress, compact = false }: { progress?: number; compact?: boolean }) => {
  const safeProgress = typeof progress === 'number' ? Math.min(Math.max(progress, 0), 100) : 0;

  return (
    <div className={compact ? 'min-w-[160px]' : 'w-full'}>
      <div className={`mb-2 flex items-center justify-between ${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
        <span>完成进度</span>
        <span className="font-medium text-primary-700">{safeProgress}%</span>
      </div>
      <div className={`${compact ? 'h-2.5' : 'h-3'} overflow-hidden rounded-full bg-gray-100`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
};

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [progressValue, setProgressValue] = useState('');
  const [progressDescription, setProgressDescription] = useState('');
  const [progressSaving, setProgressSaving] = useState(false);

  const viewMode = new URLSearchParams(location.search).get('mode');
  const navigationState = location.state as { backTo?: string; backLabel?: string } | null;
  const backTo = navigationState?.backTo || '/';
  const backLabel = navigationState?.backLabel || '返回任务列表';

  useEffect(() => {
    if (id) {
      void fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const taskData = await getTaskById(id);
      setTask(taskData);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await claimTask(task.id);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (claimId: string) => {
    if (!task) return;
    setActionLoading(true);
    try {
      await assignTask(task.id, claimId);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateProgress = async () => {
    if (!task) return;

    if (task.status === 'completed') {
      window.alert('该任务已完成，不可再登记进度');
      return;
    }

    if (progressValue.trim() === '') {
      window.alert('请先填写任务进度后再提交');
      return;
    }

    const progress = Number(progressValue);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      window.alert('任务进度请填写 0 到 100 之间的百分比');
      return;
    }

    if (typeof task.latest_progress === 'number' && progress <= task.latest_progress) {
      window.alert(`本次任务进度必须大于之前登记的 ${task.latest_progress}%`);
      return;
    }

    setProgressSaving(true);
    try {
      await createTaskProgress(task.id, {
        progress,
        description: progressDescription.trim(),
      });
      setProgressValue('');
      setProgressDescription('');
      await fetchData();
      window.alert('任务进度登记成功');
    } catch (error: any) {
      window.alert(error.message || '任务进度登记失败');
    } finally {
      setProgressSaving(false);
    }
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 9 }).map((_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${index < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));

  const canAssignClaims = user?.role === 'main_admin' || user?.role === 'expert' || task?.submitter_id === user?.id;
  const isAssigned = task?.assignee_id === user?.id;
  const hasClaimedCurrentTask = Boolean(user?.id && task?.claims?.some((claim) => claim.user_id === user.id));
  const progressReadonly = task?.status === 'completed';
  const showSubmitResultAction = viewMode !== 'progress';
  const progressLogs = useMemo(() => task?.progressLogs || [], [task?.progressLogs]);
  const claimsPagination = usePagination(task?.claims || [], [task?.id, task?.claims?.length || 0]);
  const progressPagination = usePagination(progressLogs, [task?.id, progressLogs.length]);
  const submissionsPagination = usePagination(task?.submissions || [], [task?.id, task?.submissions?.length || 0]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p className="text-gray-500">任务不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(backTo)} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
          <span>{backLabel}</span>
        </button>
      </div>

      <div className="card">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`status-${task.status} status-published`}>{statusLabels[task.status] || task.status}</span>
              {task.task_no ? (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">{task.task_no}</span>
              ) : null}
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  task.difficulty === 'simple'
                    ? 'bg-green-100 text-green-700'
                    : task.difficulty === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {difficultyLabels[task.difficulty] || task.difficulty}
              </span>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                {taskTypes[task.type] || task.type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
          </div>

          {task.rating > 0 ? (
            <div className="flex items-center">
              {renderStars(task.rating)}
              <span className="ml-2 text-sm text-gray-600">{task.rating} 星</span>
            </div>
          ) : null}
        </div>

        <div className="mb-6 flex flex-wrap gap-6 text-sm text-gray-500">
          <span className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            任务发布方：{task.submitter_name}
          </span>
          <span className="flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            任务发布时间：{formatDateTime(task.created_at)}
          </span>
          <span className="flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            任务时限：{formatDateTime(task.expected_deadline)}
          </span>
          <span className="flex items-center text-yellow-600">
            {(task.reward_type === 'both' || task.reward_type === 'points' || !task.reward_type) && (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                悬赏：{task.reward} 澳维豆
              </>
            )}
            {task.reward_type === 'both' ? ' + ' : null}
            {(task.reward_type === 'both' || task.reward_type === 'item') && (
              <>
                <Gift className="mr-2 h-4 w-4" />
                悬赏物品
              </>
            )}
          </span>
          {task.assignee_name ? (
            <span className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              任务承接方：{task.assignee_name}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-3.5">
            <div className="text-sm text-gray-500">最新任务进度</div>
            <div className="mt-2.5">
              <ProgressBar progress={task.latest_progress} />
            </div>
            <div className="mt-2.5 text-sm leading-6 text-gray-600">
              {task.latest_progress_description || '暂未登记进度描述'}
            </div>
            {task.latest_progress_updated_at ? (
              <div className="mt-2.5 text-xs text-gray-400">最近更新：{formatDateTime(task.latest_progress_updated_at)}</div>
            ) : null}
          </div>

          <div className="rounded-xl bg-gray-50 p-3.5">
            <div className="text-sm text-gray-500">任务完成情况</div>
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                  task.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : task.status === 'assigned'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {task.status === 'completed' ? '已完成' : task.status === 'assigned' ? '进行中' : '未开始'}
              </span>
            </div>
            <div className="mt-2.5 text-sm leading-6 text-gray-600">
              {task.status === 'completed'
                ? '该任务已完成，可在下方查看所有进度登记记录。'
                : task.status === 'assigned'
                  ? '该任务已分配给承接方，可持续更新执行进度。'
                  : '任务尚未进入执行阶段。'}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">任务描述</h2>
          <p className="rounded-lg bg-gray-50 p-4 leading-relaxed text-gray-600">{task.description || '暂无描述'}</p>
        </div>

        {task.review_comment ? (
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">审核意见</h2>
            <p className="rounded-lg bg-gray-50 p-4 leading-relaxed text-gray-600">{task.review_comment}</p>
          </div>
        ) : null}

        {(task.reward_type === 'both' || task.reward_type === 'item') && task.reward_item ? (
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">悬赏物品描述</h2>
            <p className="rounded-lg bg-gray-50 p-4 leading-relaxed text-gray-600">{task.reward_item}</p>
          </div>
        ) : null}
      </div>

      {(task.status === 'published' || task.status === 'claimed') && (
        <div className="card">
          <button
            onClick={() => void handleClaim()}
            disabled={actionLoading || hasClaimedCurrentTask}
            className={`flex w-full items-center justify-center space-x-2 rounded-2xl px-6 py-4 text-base font-semibold transition ${
              hasClaimedCurrentTask ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'btn-primary'
            }`}
          >
            {actionLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Users2 className="h-5 w-5" />
            )}
            <span>{hasClaimedCurrentTask ? '已申领' : '申领任务'}</span>
          </button>
        </div>
      )}

      {task.claims && task.claims.length > 0 && canAssignClaims && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">申领记录 ({task.claimCount || task.claims.length})</h2>
          <div className="space-y-3">
            {claimsPagination.pagedItems.map((claim: Claim) => (
              <div key={claim.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{claim.user_name}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(claim.claimed_at)}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                        claim.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : claim.status === 'assigned'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {claim.status === 'pending' ? '待处理' : claim.status === 'assigned' ? '已分配' : claim.status}
                    </span>
                  </div>
                </div>
                {task.status === 'claimed' && claim.status === 'pending' ? (
                  <button
                    onClick={() => void handleAssign(claim.id)}
                    disabled={actionLoading}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    分配给他
                  </button>
                ) : null}
                {task.status === 'assigned' && claim.status === 'assigned' ? (
                  <span className="text-sm font-medium text-green-600">已分配</span>
                ) : null}
              </div>
            ))}
            <PaginationControls
              page={claimsPagination.page}
              pageSize={claimsPagination.pageSize}
              totalItems={claimsPagination.totalItems}
              totalPages={claimsPagination.totalPages}
              onPageChange={claimsPagination.setPage}
              onPageSizeChange={claimsPagination.setPageSize}
            />
          </div>
        </div>
      )}

      {isAssigned && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">登记任务进度</h2>
            <p className="mt-1 text-sm text-gray-500">任务承接方可以持续更新任务进度百分比和进度描述。</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div>
              <label className="form-label">任务进度（%）</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={progressValue}
                onChange={(event) => setProgressValue(event.target.value)}
                className="form-input"
                placeholder="例如 35"
                disabled={progressReadonly}
              />
            </div>
            <div>
              <label className="form-label">进度描述</label>
              <textarea
                value={progressDescription}
                onChange={(event) => setProgressDescription(event.target.value)}
                rows={3}
                className="form-input resize-none"
                placeholder="补充说明当前阶段已完成的内容、遇到的问题或下一步安排"
                disabled={progressReadonly}
              />
            </div>
          </div>

          <button
            onClick={() => void handleCreateProgress()}
            disabled={progressSaving || progressReadonly}
            className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition ${
              progressReadonly
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-gradient-to-r from-[#7d4fff] to-[#625dff] text-white hover:opacity-95'
            }`}
          >
            {progressReadonly ? '登记进度' : progressSaving ? '登记中...' : '登记进度'}
          </button>
        </div>
      )}

      {task.status === 'assigned' && isAssigned && showSubmitResultAction && (
        <div className="card">
          <button
            onClick={() =>
              navigate(`/submit-result/${task.id}`, {
                state: {
                  backTo,
                  backLabel,
                },
              })
            }
            className="btn-primary flex w-full items-center justify-center space-x-2"
          >
            <Send className="h-5 w-5" />
            <span>提交完成结果</span>
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">任务进度记录</h2>
        {progressLogs.length === 0 ? (
          <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-gray-500">暂未登记任务进度</div>
        ) : (
          <div className="space-y-4">
            {progressPagination.pagedItems.map((log: TaskProgressLog) => (
              <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">登记人：{log.updater_name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                </div>
                <div className="mt-3">
                  <ProgressBar progress={log.progress} compact />
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                  {log.description || '未填写进度描述'}
                </div>
              </div>
            ))}
            <PaginationControls
              page={progressPagination.page}
              pageSize={progressPagination.pageSize}
              totalItems={progressPagination.totalItems}
              totalPages={progressPagination.totalPages}
              onPageChange={progressPagination.setPage}
              onPageSizeChange={progressPagination.setPageSize}
            />
          </div>
        )}
      </div>

      {task.submissions && task.submissions.length > 0 && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">提交记录</h2>
          <div className="space-y-4">
            {submissionsPagination.pagedItems.map((submission: Submission) => (
              <div key={submission.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">{submission.submitter_name}</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${
                        submission.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : submission.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {submission.status === 'approved'
                        ? '已通过'
                        : submission.status === 'rejected'
                          ? '已驳回'
                          : '待验收'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(submission.created_at)}</span>
                </div>

                {submission.description ? <p className="mb-3 text-sm text-gray-600">{submission.description}</p> : null}

                {submission.ai_tool ? (
                  <p className="mb-1 text-sm text-gray-600">
                    <span className="font-medium">使用工具：</span>
                    {submission.ai_tool}
                  </p>
                ) : null}

                {submission.prompt ? (
                  <p className="mb-1 text-sm text-gray-600">
                    <span className="font-medium">核心提示词：</span>
                    {submission.prompt}
                  </p>
                ) : null}

                {submission.usage_guide ? (
                  <p className="mb-3 text-sm text-gray-600">
                    <span className="font-medium">使用说明：</span>
                    {submission.usage_guide}
                  </p>
                ) : null}

                {submission.review_comment ? (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">审核意见：</span>
                      {submission.review_comment}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
            <PaginationControls
              page={submissionsPagination.page}
              pageSize={submissionsPagination.pageSize}
              totalItems={submissionsPagination.totalItems}
              totalPages={submissionsPagination.totalPages}
              onPageChange={submissionsPagination.setPage}
              onPageSizeChange={submissionsPagination.setPageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
}
