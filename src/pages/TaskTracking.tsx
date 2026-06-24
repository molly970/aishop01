import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Clock3,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import PaginationControls from '../components/PaginationControls';
import {
  getAllSubmissions,
  getClaimedTasks,
  getPendingTasks,
  getReviewedTasks,
  Submission,
  Task,
} from '../api/api';
import { usePagination } from '../hooks/usePagination';

type ProgressStage =
  | 'pending'
  | 'published'
  | 'claimed'
  | 'assigned'
  | 'completed'
  | 'cancelled';

type TrackingTask = Task & {
  latestSubmission?: Submission;
  claimTotal: number;
  assignedClaimCount: number;
  pendingClaimCount: number;
  progressStage: ProgressStage;
};

const stageLabels: Record<ProgressStage, string> = {
  pending: '待审核',
  published: '已发布',
  claimed: '已申领',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '已驳回',
};

const stageClasses: Record<ProgressStage, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  claimed: 'bg-sky-100 text-sky-700',
  assigned: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const submissionStatusLabels: Record<string, string> = {
  pending: '结果待审核',
  approved: '结果已通过',
  rejected: '结果已驳回',
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeStage = (status?: string): ProgressStage => {
  switch (status) {
    case 'published':
    case 'claimed':
    case 'assigned':
    case 'completed':
    case 'cancelled':
      return status;
    default:
      return 'pending';
  }
};

const toTimestamp = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export default function TaskTracking() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [records, setRecords] = useState<TrackingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | ProgressStage>('all');
  const [submissionFilter, setSubmissionFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'none'
  >('all');

  const hasAccess =
    user?.role === 'admin' || user?.role === 'main_admin' || user?.role === 'expert';

  useEffect(() => {
    if (!hasAccess) {
      navigate('/');
      return;
    }

    void fetchTrackingData(true);
    const timer = window.setInterval(() => {
      void fetchTrackingData(false);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [hasAccess, navigate]);

  const fetchTrackingData = async (showLoading: boolean) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [pendingTasks, reviewedTasks, claimTasks, submissions] = await Promise.all([
        getPendingTasks(),
        getReviewedTasks(),
        getClaimedTasks(),
        getAllSubmissions(),
      ]);

      const taskMap = new Map<string, TrackingTask>();

      [...pendingTasks, ...reviewedTasks, ...claimTasks].forEach((task) => {
        const existing = taskMap.get(task.id);
        const claims = task.claims || existing?.claims || [];
        taskMap.set(task.id, {
          ...(existing || {}),
          ...task,
          claims,
          claimTotal: claims.length,
          assignedClaimCount: claims.filter((claim) => claim.status === 'assigned').length,
          pendingClaimCount: claims.filter((claim) => claim.status === 'pending').length,
          progressStage: normalizeStage(task.status || existing?.status),
        });
      });

      const latestSubmissionMap = new Map<string, Submission>();
      submissions.forEach((submission) => {
        const current = latestSubmissionMap.get(submission.task_id);
        if (!current || toTimestamp(submission.created_at) >= toTimestamp(current.created_at)) {
          latestSubmissionMap.set(submission.task_id, submission);
        }
      });

      const merged = Array.from(taskMap.values())
        .map((task) => {
          const latestSubmission = latestSubmissionMap.get(task.id);
          const claims = task.claims || [];
          return {
            ...task,
            latestSubmission,
            claimTotal: claims.length,
            assignedClaimCount: claims.filter((claim) => claim.status === 'assigned').length,
            pendingClaimCount: claims.filter((claim) => claim.status === 'pending').length,
            progressStage: normalizeStage(task.status),
          };
        })
        .sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at));

      setRecords(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        record.title.toLowerCase().includes(keyword) ||
        record.task_no?.toLowerCase().includes(keyword) ||
        record.submitter_name.toLowerCase().includes(keyword) ||
        record.assignee_name?.toLowerCase().includes(keyword);

      const matchesStage = stageFilter === 'all' || record.progressStage === stageFilter;
      const submissionStatus = record.latestSubmission?.status;
      const matchesSubmission =
        submissionFilter === 'all' ||
        (submissionFilter === 'none' && !submissionStatus) ||
        submissionStatus === submissionFilter;

      return matchesSearch && matchesStage && matchesSubmission;
    });
  }, [records, search, stageFilter, submissionFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((record) => record.progressStage === 'pending').length;
    const published = records.filter((record) => record.progressStage === 'published').length;
    const assigned = records.filter((record) => record.progressStage === 'assigned').length;
    const completed = records.filter((record) => record.progressStage === 'completed').length;
    const resultPending = records.filter(
      (record) => record.latestSubmission?.status === 'pending'
    ).length;

    return { total, pending, published, assigned, completed, resultPending };
  }, [records]);

  const pagination = usePagination(filteredRecords, [search, stageFilter, submissionFilter, filteredRecords.length]);

  if (!hasAccess) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">任务全流程跟踪表</h1>
            <p className="mt-1 text-gray-500">
              统一查看任务发布、申领、分配、结果提交与完成进度
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchTrackingData(false)}
          className="btn-secondary flex items-center gap-2"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? '刷新中...' : '立即刷新'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">任务总数</span>
            <Activity className="h-4 w-4 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-500">待审核</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-500">已发布</div>
          <div className="text-2xl font-bold text-green-600">{stats.published}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-500">已分配</div>
          <div className="text-2xl font-bold text-purple-600">{stats.assigned}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-500">已完成</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-500">结果待审核</div>
          <div className="text-2xl font-bold text-orange-600">{stats.resultPending}</div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务名称、编号、任务发布方、任务承接方"
              className="form-input pl-10"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
            className="form-input"
          >
            <option value="all">全部任务阶段</option>
            <option value="pending">待审核</option>
            <option value="published">已发布</option>
            <option value="claimed">已申领</option>
            <option value="assigned">已分配</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已驳回</option>
          </select>

          <select
            value={submissionFilter}
            onChange={(e) => setSubmissionFilter(e.target.value as typeof submissionFilter)}
            className="form-input"
          >
            <option value="all">全部结果状态</option>
            <option value="none">未提交结果</option>
            <option value="pending">结果待审核</option>
            <option value="approved">结果已通过</option>
            <option value="rejected">结果已驳回</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-500">当前筛选条件下暂无任务记录</div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">任务</th>
                  <th className="px-4 py-3 font-medium">当前阶段</th>
                  <th className="px-4 py-3 font-medium">任务发布方</th>
                  <th className="px-4 py-3 font-medium">任务承接方</th>
                  <th className="px-4 py-3 font-medium">申领统计</th>
                  <th className="px-4 py-3 font-medium">结果状态</th>
                  <th className="px-4 py-3 font-medium">最近更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagination.pagedItems.map((record) => (
                  <tr
                    key={record.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/task/${record.id}`)}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-gray-800">{record.title}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {record.task_no || '未生成任务编号'}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stageClasses[record.progressStage]}`}
                      >
                        {stageLabels[record.progressStage]}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-gray-800">
                      <div>{record.submitter_name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        发布时间：{formatDateTime(record.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {record.assignee_name ? (
                        <>
                          <div className="text-gray-800">{record.assignee_name}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            承接时间：{formatDateTime(record.assigned_at || record.updated_at)}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">暂未分配</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2 text-gray-800">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{record.claimTotal}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        待分配 {record.pendingClaimCount} / 已分配 {record.assignedClaimCount}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {record.latestSubmission ? (
                        <>
                          <div className="text-gray-800">
                            {submissionStatusLabels[record.latestSubmission.status] ||
                              record.latestSubmission.status}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            最近提交：{record.latestSubmission.submitter_name}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">未提交结果</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-gray-800">{formatDateTime(record.updated_at)}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        期望完成：{formatDateTime(record.expected_deadline)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 font-medium text-gray-700">
          <Clock3 className="h-4 w-4" />
          <span>跟踪说明</span>
        </div>
        <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            任务发布链路：待审核 {'->'} 已发布 / 已驳回
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            任务执行链路：已申领 {'->'} 已分配 {'->'} 已完成
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            结果审核链路：未提交结果 / 结果待审核 / 结果已通过 / 结果已驳回
          </div>
        </div>
      </div>
    </div>
  );
}
