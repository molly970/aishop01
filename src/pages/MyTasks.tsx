import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Calendar, Clock, FileText, ListChecks, Trophy, User, Users } from 'lucide-react';
import { getMyClaims, getMySubmissions, getMyTasks, MyClaimTask, Submission, Task } from '../api/api';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';

const taskStatusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  claimed: '待分配',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '未通过',
};

const submissionStatusLabels: Record<string, string> = {
  pending: '待验收',
  approved: '已通过',
  rejected: '已驳回',
};

const claimStatusClassMap: Record<string, string> = {
  待分配: 'bg-yellow-100 text-yellow-700',
  已分配: 'bg-green-100 text-green-700',
  已分配给他人: 'bg-gray-100 text-gray-700',
  已完成: 'bg-blue-100 text-blue-700',
  任务已取消: 'bg-red-100 text-red-700',
};

type RecordTab = 'tasks' | 'claims' | 'submissions' | 'beans';

export default function MyTasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');
  const taskStatusFilter = searchParams.get('status') || '';

  const [activeTab, setActiveTab] = useState<RecordTab>(
    currentTab === 'claims' || currentTab === 'submissions' || currentTab === 'beans' ? currentTab : 'tasks'
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [claims, setClaims] = useState<MyClaimTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'claims' || tab === 'submissions' || tab === 'tasks' || tab === 'beans') {
      setActiveTab(tab);
    } else {
      setActiveTab('tasks');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'tasks' || activeTab === 'beans') {
      void fetchTasks();
      return;
    }

    if (activeTab === 'claims') {
      void fetchClaims();
      return;
    }

    void fetchSubmissions();
  }, [activeTab]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyTasks();
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        setTasks([]);
        setError((data as any)?.error || '获取我的任务失败');
      }
    } catch (fetchError: any) {
      setTasks([]);
      setError(fetchError?.message || '获取我的任务失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyClaims();
      if (Array.isArray(data)) {
        setClaims(data);
      } else {
        setClaims([]);
        setError((data as any)?.error || '获取我的申领失败');
      }
    } catch (fetchError: any) {
      setClaims([]);
      setError(fetchError?.message || '获取我的申领失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMySubmissions();
      if (Array.isArray(data)) {
        setSubmissions(data);
      } else {
        setSubmissions([]);
        setError((data as any)?.error || '获取我的提交失败');
      }
    } catch (fetchError: any) {
      setSubmissions([]);
      setError(fetchError?.message || '获取我的提交失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN');
  };

  const tabClass = (tab: RecordTab) =>
    `rounded-lg px-4 py-2 font-medium transition-colors ${
      activeTab === tab ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  const visibleTasks = useMemo(
    () => (taskStatusFilter ? tasks.filter((task) => task.status === taskStatusFilter) : tasks),
    [taskStatusFilter, tasks]
  );

  const beanRecords = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'completed')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [tasks]
  );

  const totalBeans = useMemo(
    () => beanRecords.reduce((sum, task) => sum + (Number(task.reward) || 0), 0),
    [beanRecords]
  );

  const tasksPagination = usePagination(visibleTasks, [activeTab, taskStatusFilter, visibleTasks.length]);
  const claimsPagination = usePagination(claims, [activeTab, claims.length]);
  const submissionsPagination = usePagination(submissions, [activeTab, submissions.length]);
  const beansPagination = usePagination(beanRecords, [activeTab, beanRecords.length]);

  const switchTab = (tab: RecordTab) => {
    setActiveTab(tab);
    if (tab === 'tasks') {
      setSearchParams(taskStatusFilter ? { tab, status: taskStatusFilter } : { tab });
      return;
    }
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">我的记录</h1>
        <p className="mt-1 text-gray-500">查看我的任务、我的申领、结果提交记录与澳维豆明细</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <button onClick={() => switchTab('tasks')} className={tabClass('tasks')}>
          我的任务
        </button>
        <button onClick={() => switchTab('claims')} className={tabClass('claims')}>
          我的申领
        </button>
        <button onClick={() => switchTab('submissions')} className={tabClass('submissions')}>
          我的提交
        </button>
        <button onClick={() => switchTab('beans')} className={tabClass('beans')}>
          我的澳维豆
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card border border-red-100 bg-red-50 py-6">
          <div className="flex items-start gap-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <div className="font-medium">加载失败</div>
              <div className="mt-1 text-sm text-red-600">{error}</div>
            </div>
          </div>
        </div>
      ) : activeTab === 'tasks' ? (
        visibleTasks.length === 0 ? (
          <div className="card py-12 text-center">
            <Clock className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-gray-500">暂无任务记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasksPagination.pagedItems.map((task) => (
              <div
                key={task.id}
                className="card cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() =>
                  navigate(`/task/${task.id}`, {
                    state: { backTo: '/my-tasks?tab=tasks', backLabel: '返回我的任务' },
                  })
                }
              >
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      task.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : task.status === 'completed'
                          ? 'bg-gray-100 text-gray-700'
                          : task.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : task.status === 'claimed'
                              ? 'bg-blue-100 text-blue-700'
                              : task.status === 'assigned'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {taskStatusLabels[task.status] || task.status}
                  </span>
                  <div className="flex items-center text-yellow-600">
                    <Trophy className="mr-1 h-4 w-4" />
                    <span className="font-medium">{task.reward} 澳维豆</span>
                  </div>
                </div>

                {task.task_no ? <div className="mb-2 text-xs text-gray-500">{task.task_no}</div> : null}

                <h3 className="mb-2 text-lg font-semibold text-gray-800">{task.title}</h3>
                <p className="mb-3 line-clamp-2 text-sm text-gray-600">{task.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center">
                    <User className="mr-1 h-4 w-4" />
                    {task.submitter_name}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    {formatDate(task.created_at)}
                  </span>
                </div>

                <div className="mt-3 flex justify-end">
                  <button className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-700">
                    查看详情 <ArrowRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <PaginationControls
              page={tasksPagination.page}
              pageSize={tasksPagination.pageSize}
              totalItems={tasksPagination.totalItems}
              totalPages={tasksPagination.totalPages}
              onPageChange={tasksPagination.setPage}
              onPageSizeChange={tasksPagination.setPageSize}
            />
          </div>
        )
      ) : activeTab === 'claims' ? (
        claims.length === 0 ? (
          <div className="card py-12 text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-gray-500">暂无申领记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claimsPagination.pagedItems.map((claim) => (
              <div
                key={claim.claim_id}
                className="card cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() =>
                  navigate(`/task/${claim.id}`, {
                    state: { backTo: '/my-tasks?tab=claims', backLabel: '返回我的申领' },
                  })
                }
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    {claim.task_no ? <div className="mb-2 text-xs text-gray-500">{claim.task_no}</div> : null}
                    <h3 className="text-lg font-semibold text-gray-800">{claim.title}</h3>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      claimStatusClassMap[claim.application_status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {claim.application_status}
                  </span>
                </div>

                <p className="mb-4 line-clamp-2 text-sm text-gray-600">{claim.description}</p>

                <div className="grid gap-3 text-sm text-gray-500 sm:grid-cols-2">
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    申领时间：{formatDate(claim.claimed_at)}
                  </span>
                  <span className="flex items-center">
                    <Clock className="mr-1 h-4 w-4" />
                    期望完成时间：{formatDate(claim.expected_deadline)}
                  </span>
                  <span className="flex items-center">
                    <User className="mr-1 h-4 w-4" />
                    任务发布方：{claim.submitter_name}
                  </span>
                  <span className="flex items-center">
                    <Trophy className="mr-1 h-4 w-4" />
                    奖励：{claim.reward} 澳维豆
                  </span>
                </div>

                {claim.application_status === '已分配给他人' ? (
                  <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    该任务已分配给他人，当前申领记录仅保留为查看状态。
                  </div>
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
        )
      ) : activeTab === 'submissions' ? (
        submissions.length === 0 ? (
          <div className="card py-12 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-gray-500">暂无提交记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissionsPagination.pagedItems.map((submission) => (
              <div key={submission.id} className="card">
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      submission.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : submission.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {submissionStatusLabels[submission.status] || submission.status}
                  </span>
                  <div className="text-xs text-gray-500">{submission.task_no}</div>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-gray-800">任务结果提交</h3>
                {submission.description ? <p className="mb-3 text-sm text-gray-600">{submission.description}</p> : null}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    {formatDate(submission.created_at)}
                  </span>
                </div>

                {submission.review_comment ? (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">验收意见：</span>
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
        )
      ) : (
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600">
                <Trophy className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm text-gray-500">已获得澳维豆总数</div>
                <div className="mt-1 text-3xl font-bold text-gray-900">{totalBeans}</div>
              </div>
            </div>
          </div>

          {beanRecords.length === 0 ? (
            <div className="card py-12 text-center">
              <ListChecks className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="text-gray-500">暂无澳维豆获取明细</p>
            </div>
          ) : (
            <div className="space-y-3">
              {beansPagination.pagedItems.map((task) => (
                <div
                  key={task.id}
                  className="card cursor-pointer py-5 transition-shadow hover:shadow-lg"
                  onClick={() =>
                    navigate(`/task/${task.id}`, {
                      state: { backTo: '/my-tasks?tab=beans', backLabel: '返回我的澳维豆' },
                    })
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          已完成
                        </span>
                        {task.task_no ? <span className="text-xs text-gray-500">{task.task_no}</span> : null}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1.5 text-sm font-semibold text-yellow-700">
                        <span className="text-gray-500">本次获得</span>
                        <Trophy className="h-4 w-4 text-yellow-600" />
                        <span>{task.reward} 澳维豆</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-800">{task.title}</h3>
                    <p className="line-clamp-1 text-sm text-gray-600">{task.description}</p>

                    <div className="grid gap-2 text-sm text-gray-500 sm:grid-cols-2">
                      <span className="flex items-center">
                        <User className="mr-1 h-4 w-4" />
                        来源任务发布方：{task.submitter_name}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        获取时间：{formatDateTime(task.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <PaginationControls
                page={beansPagination.page}
                pageSize={beansPagination.pageSize}
                totalItems={beansPagination.totalItems}
                totalPages={beansPagination.totalPages}
                onPageChange={beansPagination.setPage}
                onPageSizeChange={beansPagination.setPageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
