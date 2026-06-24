import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import PaginationControls from '../components/PaginationControls';
import {
  Task,
  Submission,
  assignTask,
  deleteSubmission,
  getAllSubmissions,
  getClaimedTasks,
  getPendingTasks,
  getReviewedTasks,
  reviewSubmission,
  reviewTask,
} from '../api/api';
import { usePagination } from '../hooks/usePagination';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Edit3,
  Eye,
  Gift,
  Star,
  Trophy,
  User,
  XCircle,
} from 'lucide-react';

const statusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已通过',
  claimed: '待分配',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '已拒绝',
};

const difficultyLabels: Record<string, string> = {
  simple: '简单',
  medium: '中等',
  complex: '复杂',
};

const starLevels = [
  { type: 'application', label: '应用思维', stars: [1, 2, 3] },
  { type: 'product', label: '产品思维', stars: [1, 2, 3] },
  { type: 'engineering', label: '工程思维', stars: [1, 2, 3] },
];

export default function Review() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'tasks' | 'claims' | 'submissions'>('tasks');
  const [taskSubTab, setTaskSubTab] = useState<'pending' | 'reviewed'>('pending');
  const [submissionSubTab, setSubmissionSubTab] = useState<'pending' | 'reviewed'>('pending');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [claimedTasks, setClaimedTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [taskRatings, setTaskRatings] = useState({
    application: 0,
    product: 0,
    engineering: 0,
  });
  const [submissionRatings, setSubmissionRatings] = useState({
    application: 0,
    product: 0,
    engineering: 0,
  });
  const [comment, setComment] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'main_admin';
  const isExpert = user?.role === 'expert' || user?.role === 'main_admin';
  const canReviewTasksAndClaims = isAdmin || isExpert;
  const hasReviewAccess = canReviewTasksAndClaims;
  const isMainAdmin = user?.role === 'main_admin';
  const claimsPagination = usePagination(claimedTasks, [activeTab, claimedTasks.length]);
  const tasksPagination = usePagination(tasks, [activeTab, taskSubTab, tasks.length]);
  const submissionsPagination = usePagination(submissions, [activeTab, submissionSubTab, submissions.length]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const status = searchParams.get('status');

    if (tab === 'claims' && canReviewTasksAndClaims) {
      setActiveTab('claims');
    } else if (tab === 'submissions') {
      setActiveTab('submissions');
    } else if (tab === 'tasks' && canReviewTasksAndClaims) {
      setActiveTab('tasks');
    } else if (!canReviewTasksAndClaims) {
      setActiveTab('submissions');
    }

    if (status === 'pending' || status === 'reviewed') {
      setTaskSubTab(status);
      setSubmissionSubTab(status);
    }
  }, [searchParams, canReviewTasksAndClaims]);

  useEffect(() => {
    if (!hasReviewAccess) {
      navigate('/');
      return;
    }
    if (!canReviewTasksAndClaims && activeTab !== 'submissions') {
      setActiveTab('submissions');
      return;
    }
    void fetchData();
  }, [activeTab, taskSubTab, submissionSubTab, hasReviewAccess, canReviewTasksAndClaims, navigate]);

  const toTimestamp = (value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const sortClaimsByLatestTime = (items: Task[]) =>
    [...items].sort((a, b) => {
      const aLatest = Math.max(
        toTimestamp(a.updated_at),
        ...(a.claims || []).map((claim: any) => toTimestamp(claim.claimed_at))
      );
      const bLatest = Math.max(
        toTimestamp(b.updated_at),
        ...(b.claims || []).map((claim: any) => toTimestamp(claim.claimed_at))
      );
      return bLatest - aLatest;
    });

  const sortSubmissionsByLatestTime = (items: Submission[], reviewed: boolean) =>
    [...items].sort((a, b) => {
      const aTime = reviewed ? toTimestamp(a.reviewed_at || a.created_at) : toTimestamp(a.created_at);
      const bTime = reviewed ? toTimestamp(b.reviewed_at || b.created_at) : toTimestamp(b.created_at);
      return bTime - aTime;
    });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tasks') {
        if (!canReviewTasksAndClaims) {
          setTasks([]);
          return;
        }
        const data = taskSubTab === 'pending' ? await getPendingTasks() : await getReviewedTasks();
        setTasks(Array.isArray(data) ? data : []);
      } else if (activeTab === 'claims') {
        if (!canReviewTasksAndClaims) {
          setClaimedTasks([]);
          return;
        }
        const data = await getClaimedTasks();
        setClaimedTasks(Array.isArray(data) ? sortClaimsByLatestTime(data) : []);
      } else {
        const data = await getAllSubmissions();
        const safeData = Array.isArray(data) ? data : [];
        setSubmissions(
          submissionSubTab === 'pending'
            ? sortSubmissionsByLatestTime(
                safeData.filter((item) => item.status === 'pending'),
                false
              )
            : sortSubmissionsByLatestTime(
                safeData.filter((item) => item.status === 'approved' || item.status === 'rejected'),
                true
              )
        );
      }
    } catch (error) {
      console.error('Review fetch failed:', error);
      setTasks([]);
      setClaimedTasks([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskRatingChange = (type: string, star: number) => {
    setTaskRatings((prev) => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] === star ? 0 : star,
    }));
  };

  const handleSubmissionRatingChange = (type: string, star: number) => {
    setSubmissionRatings((prev) => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] === star ? 0 : star,
    }));
  };

  const handleReviewTask = async (approved: boolean) => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const ratings = Object.entries(taskRatings)
        .filter(([, value]) => value > 0)
        .map(([type, star]) => `${type}:${star}`)
        .join(',');

      await reviewTask(selectedTask.id, { approved, comment, ratings });
      setSelectedTask(null);
      setTaskRatings({ application: 0, product: 0, engineering: 0 });
      setComment('');
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSubmission = async (approved: boolean) => {
    if (!selectedSubmission) return;
    setActionLoading(true);
    try {
      const ratings = Object.entries(submissionRatings)
        .filter(([, value]) => value > 0)
        .map(([type, star]) => `${type}:${star}`)
        .join(',');

      await reviewSubmission(selectedSubmission.id, {
        approved,
        review_comment: comment,
        ratings,
      });
      setSelectedSubmission(null);
      setSubmissionRatings({ application: 0, product: 0, engineering: 0 });
      setComment('');
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTask = async (taskId: string, claimId: string) => {
    setActionLoading(true);
    try {
      await assignTask(taskId, claimId);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReviewedSubmission = async (submission: Submission) => {
    const taskTitle = (submission as any).taskTitle || '该结果';
    const confirmed = window.confirm(`确认删除“${taskTitle}”的已审核结果吗？删除后无法恢复。`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteSubmission(submission.id);
      if (selectedSubmission?.id === submission.id) {
        setSelectedSubmission(null);
      }
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除审核结果失败';
      window.alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const renderStars = (rating: number = 0) => {
    const safeRating = Math.max(0, Math.min(9, rating));
    return (
      <div className="flex flex-wrap items-center gap-1">
        {Array.from({ length: safeRating }).map((_, index) => (
          <Star key={index} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
    );
  };

  const renderRatingButtons = (
    values: { application: number; product: number; engineering: number },
    onChange: (type: string, star: number) => void
  ) =>
    starLevels.map((level) => (
      <div key={level.type} className="mb-3">
        <div className="mb-2 flex items-center gap-3">
          <span className="w-24 text-sm font-medium text-gray-700">{level.label}</span>
          <div className="flex gap-1">
            {level.stars.map((star) => {
              const active = values[level.type as keyof typeof values] === star;
              return (
                <button
                  key={star}
                  onClick={() => onChange(level.type, star)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                    active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`h-4 w-4 ${active ? 'fill-yellow-300 text-yellow-300' : ''}`} />
                  <span>{star}星</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onChange(level.type, 0)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              values[level.type as keyof typeof values] === 0
                ? 'text-gray-400'
                : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            不选
          </button>
        </div>
      </div>
    ));

  if (!hasReviewAccess) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
          <span>返回</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">审核管理</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        {canReviewTasksAndClaims && (
          <button
            onClick={() => setActiveTab('tasks')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'tasks' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            任务审核
          </button>
        )}
        {canReviewTasksAndClaims && (
          <button
            onClick={() => setActiveTab('claims')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              activeTab === 'claims' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            任务申领审核
          </button>
        )}
        <button
          onClick={() => setActiveTab('submissions')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'submissions' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          结果审核
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={() => setTaskSubTab('pending')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              taskSubTab === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            待审核任务
          </button>
          <button
            onClick={() => setTaskSubTab('reviewed')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              taskSubTab === 'reviewed' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            已审核任务
          </button>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={() => setSubmissionSubTab('pending')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              submissionSubTab === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            待审核结果
          </button>
          <button
            onClick={() => setSubmissionSubTab('reviewed')}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              submissionSubTab === 'reviewed' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            已审核结果
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : activeTab === 'claims' ? (
        claimedTasks.length === 0 ? (
          <div className="card py-12 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <p className="text-gray-500">暂无待分配任务</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claimsPagination.pagedItems.map((task) => (
              <div key={task.id} className="card">
                <div className="mb-3 flex items-start justify-between">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">待分配</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      task.difficulty === 'simple'
                        ? 'bg-green-100 text-green-700'
                        : task.difficulty === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {difficultyLabels[task.difficulty]}
                  </span>
                </div>

                {task.task_no && <div className="mb-2 text-xs text-gray-500">{task.task_no}</div>}
                <h3 className="mb-2 text-lg font-semibold text-gray-800">{task.title}</h3>
                <p className="mb-3 text-sm text-gray-600 line-clamp-2">{task.description}</p>

                <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center">
                    <User className="mr-1 h-4 w-4" />
                    {task.submitter_name}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    截止: {formatDate(task.expected_deadline)}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {(task.reward_type === 'both' || task.reward_type === 'points' || !task.reward_type) && (
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-yellow-600">{task.reward} 澳维豆</span>
                    </div>
                  )}
                  {(task.reward_type === 'both' || task.reward_type === 'item') && (
                    <div className="flex items-center gap-1">
                      <Gift className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-yellow-600">悬赏物品</span>
                    </div>
                  )}
                </div>

                {task.claims && task.claims.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <h4 className="mb-2 text-sm font-medium text-gray-700">申领人员 ({task.claims.length})</h4>
                    <div className="space-y-2">
                      {task.claims.map((claim: any) => (
                        <div key={claim.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
                          <div>
                            <span className="font-medium text-gray-800">{claim.user_name}</span>
                            <span className="ml-2 text-xs text-gray-500">{formatDate(claim.claimed_at)}</span>
                          </div>
                          {claim.status === 'pending' ? (
                            <button
                              onClick={() => void handleAssignTask(task.id, claim.id)}
                              disabled={actionLoading}
                              className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                              分配给他
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-green-600">已分配</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        )
      ) : activeTab === 'tasks' ? (
        tasks.length === 0 ? (
          <div className="card py-12 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <p className="text-gray-500">{taskSubTab === 'pending' ? '暂无待审核任务' : '暂无已审核任务'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasksPagination.pagedItems.map((task) => (
              <div key={task.id} className="card">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      task.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : task.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabels[task.status] || task.status}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      task.difficulty === 'simple'
                        ? 'bg-green-100 text-green-700'
                        : task.difficulty === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {difficultyLabels[task.difficulty]}
                  </span>
                </div>

                {task.task_no && <div className="mb-2 text-xs text-gray-500">{task.task_no}</div>}
                <h3 className="mb-2 text-lg font-semibold text-gray-800">{task.title}</h3>
                <p className="mb-3 text-sm text-gray-600 line-clamp-2">{task.description}</p>

                <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center">
                    <User className="mr-1 h-4 w-4" />
                    {task.submitter_name}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    {formatDate(task.created_at)}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {(task.reward_type === 'both' || task.reward_type === 'points' || !task.reward_type) && (
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-yellow-600">{task.reward} 澳维豆</span>
                    </div>
                  )}
                  {(task.reward_type === 'both' || task.reward_type === 'item') && (
                    <div className="flex items-center gap-1">
                      <Gift className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-yellow-600">悬赏物品</span>
                    </div>
                  )}
                </div>

                {task.reward_type === 'item' && task.reward_item && (
                  <div className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-500">悬赏物：{task.reward_item}</div>
                )}

                {taskSubTab === 'reviewed' && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="mb-2 flex items-center">
                      <span
                        className={`mr-2 rounded-full px-2 py-1 text-xs font-medium ${
                          task.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {task.status === 'published' ? '已通过' : '已拒绝'}
                      </span>
                      {task.rating > 0 && (
                        <div className="flex items-center">
                          {renderStars(task.rating)}
                          <span className="ml-1 text-xs text-gray-500">({task.rating} 星)</span>
                        </div>
                      )}
                    </div>
                    {task.review_comment && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">审核意见：</span>
                        {task.review_comment}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">截止：{formatDate(task.expected_deadline)}</div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button onClick={() => navigate(`/task/${task.id}`)} className="btn-secondary px-3 py-1 text-sm">
                      <Eye className="mr-1 inline h-4 w-4" />
                      {taskSubTab === 'pending' ? '查看' : '查看详情'}
                    </button>

                    {taskSubTab === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setTaskRatings({ application: 0, product: 0, engineering: 0 });
                          setComment('');
                        }}
                        className="btn-primary inline-flex items-center gap-1 px-3 py-1 text-sm"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>审核</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="md:col-span-2 lg:col-span-3">
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
        )
      ) : submissions.length === 0 ? (
        <div className="card py-12 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <p className="text-gray-500">{submissionSubTab === 'pending' ? '暂无待审核结果' : '暂无已审核结果'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissionsPagination.pagedItems.map((submission) => (
            <div key={submission.id} className="card">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{(submission as any).taskTitle || '任务结果'}</h3>
                  {(submission as any).taskNo && <span className="text-xs text-gray-500">{(submission as any).taskNo}</span>}
                </div>
                <span className="text-xs text-gray-500">{formatDate(submission.created_at)}</span>
              </div>

              <p className="mb-2 text-sm text-gray-600">提交人：{submission.submitter_name}</p>
              {submission.description && <p className="mb-3 text-sm text-gray-600">{submission.description}</p>}
              {submission.ai_tool && (
                <p className="mb-1 text-sm text-gray-600">
                  <span className="font-medium">使用工具：</span>
                  {submission.ai_tool}
                </p>
              )}
              {submission.prompt && (
                <p className="mb-1 text-sm text-gray-600">
                  <span className="font-medium">核心提示词：</span>
                  {submission.prompt}
                </p>
              )}

              {submissionSubTab === 'reviewed' && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 flex items-center">
                    <span
                      className={`mr-2 rounded-full px-2 py-1 text-xs font-medium ${
                        submission.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {submission.status === 'approved' ? '已通过' : '已拒绝'}
                    </span>
                  </div>
                  {(submission.rating || 0) > 0 && (
                    <div className="mb-2 flex items-center">
                      <span className="mr-2 text-sm font-medium">评分：</span>
                      {renderStars(submission.rating || 0)}
                      <span className="ml-1 text-xs text-gray-500">({submission.rating} 星)</span>
                    </div>
                  )}
                  {submission.review_comment && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">审核意见：</span>
                      {submission.review_comment}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                {submissionSubTab === 'pending' ? (
                  <button
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setSubmissionRatings({ application: 0, product: 0, engineering: 0 });
                      setComment('');
                    }}
                    className="btn-primary inline-flex items-center gap-1 text-sm"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>审核</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/task/${submission.task_id}`)}
                      className="btn-secondary inline-flex items-center gap-1 text-sm"
                    >
                      <Eye className="h-4 w-4" />
                      <span>查看详情</span>
                    </button>
                    {isMainAdmin && (
                      <button
                        onClick={() => void handleDeleteReviewedSubmission(submission)}
                        disabled={actionLoading}
                        className="btn-danger inline-flex items-center gap-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>删除结果</span>
                      </button>
                    )}
                  </>
                )}
              </div>
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
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="border-b p-6">
              <h2 className="text-xl font-bold text-gray-800">审核任务</h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{selectedTask.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                    {statusLabels[selectedTask.status]}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">任务描述</h4>
                <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedTask.description}</p>
              </div>

              <div className="mb-6">
                <h4 className="mb-3 text-sm font-medium text-gray-700">评级评星（可多选或不选）</h4>
                {renderRatingButtons(taskRatings, handleTaskRatingChange)}
              </div>

              <div className="mb-6">
                <h4 className="mb-2 text-sm font-medium text-gray-700">审核意见</h4>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="请输入审核意见（可选）..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setSelectedTask(null)} className="btn-secondary flex-1">
                  取消
                </button>
                <button
                  onClick={() => void handleReviewTask(false)}
                  disabled={actionLoading}
                  className="btn-danger flex flex-1 items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span>拒绝</span>
                </button>
                <button
                  onClick={() => void handleReviewTask(true)}
                  disabled={actionLoading}
                  className="btn-success flex flex-1 items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  <span>通过</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="border-b p-6">
              <h2 className="text-xl font-bold text-gray-800">审核结果</h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{(selectedSubmission as any).taskTitle || '任务结果'}</h3>
                <p className="mt-1 text-sm text-gray-500">提交人：{selectedSubmission.submitter_name}</p>
              </div>

              {selectedSubmission.description && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-700">描述</h4>
                  <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedSubmission.description}</p>
                </div>
              )}

              {selectedSubmission.ai_tool && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-700">使用工具</h4>
                  <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedSubmission.ai_tool}</p>
                </div>
              )}

              {selectedSubmission.prompt && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-700">核心提示词</h4>
                  <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedSubmission.prompt}</p>
                </div>
              )}

              {selectedSubmission.usage_guide && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-700">使用说明</h4>
                  <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{selectedSubmission.usage_guide}</p>
                </div>
              )}

              <div className="mb-6">
                <h4 className="mb-3 text-sm font-medium text-gray-700">评级评星（可多选或不选）</h4>
                {renderRatingButtons(submissionRatings, handleSubmissionRatingChange)}
              </div>

              <div className="mb-6">
                <h4 className="mb-2 text-sm font-medium text-gray-700">审核意见</h4>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="请输入审核意见（可选）..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setSelectedSubmission(null)} className="btn-secondary flex-1">
                  取消
                </button>
                <button
                  onClick={() => void handleReviewSubmission(false)}
                  disabled={actionLoading}
                  className="btn-danger flex flex-1 items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span>拒绝</span>
                </button>
                <button
                  onClick={() => void handleReviewSubmission(true)}
                  disabled={actionLoading}
                  className="btn-success flex flex-1 items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  <span>通过</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
