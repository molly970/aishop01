import { MouseEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { getPublicBoardTasks, Task } from '../api/api';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';
import { useAuthStore } from '../store/authStore';

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

const ProgressBar = ({ progress }: { progress?: number }) => {
  const safeProgress = typeof progress === 'number' ? Math.min(Math.max(progress, 0), 100) : null;

  if (safeProgress === null) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <div className="w-[108px]">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>当前进度</span>
        <span className="font-medium text-primary-700">{safeProgress}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
};

export default function TaskPublicBoard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [records, setRecords] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination(records, [records.length]);

  useEffect(() => {
    void fetchRecords(true);
  }, []);

  const fetchRecords = async (showLoading: boolean) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const data = await getPublicBoardTasks();
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        setRecords([]);
        setError((data as { error?: string })?.error || '获取任务公示失败');
      }
    } catch (fetchError: any) {
      setRecords([]);
      setError(fetchError?.message || '获取任务公示失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOpenTask = (taskId: string) => {
    navigate(`/task/${taskId}`, {
      state: { backTo: '/public-board', backLabel: '返回任务公示站' },
    });
  };

  const handleOpenSubmitResult = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/submit-result/${taskId}`, {
      state: { backTo: '/public-board', backLabel: '返回任务公示站' },
    });
  };

  const handleOpenProgressEntry = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/task/${taskId}?mode=progress`, {
      state: { backTo: '/public-board', backLabel: '返回任务公示站' },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:pr-[240px]">
        <div className="flex flex-wrap items-start gap-4">
          <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">任务公示站</h1>
              <button
                onClick={() => void fetchRecords(false)}
                className="btn-secondary flex items-center gap-2"
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? '刷新中...' : '立即刷新'}</span>
              </button>
            </div>
            <p className="mt-1 text-gray-500">查看已公示任务的承接情况和最新进度</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <div className="font-medium">加载失败</div>
              <div className="mt-1 text-sm text-red-600">{error}</div>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-gray-500">当前暂无公示任务</div>
        ) : (
          <>
          <div className="overflow-x-auto pb-2">
            <table className="min-w-[1320px] table-fixed text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-700">
                  <th className="w-[112px] px-4 py-3 font-semibold">任务名称</th>
                  <th className="w-[132px] px-4 py-3 font-semibold">任务发布方</th>
                  <th className="w-[132px] px-4 py-3 font-semibold">任务承接方</th>
                  <th className="w-[128px] px-4 py-3 font-semibold">承接时间</th>
                  <th className="w-[132px] px-4 py-3 font-semibold">任务时限</th>
                  <th className="w-[112px] px-4 py-3 font-semibold">完成情况</th>
                  <th className="w-[132px] px-4 py-3 font-semibold">任务进度</th>
                  <th className="w-[140px] px-4 py-3 font-semibold">进度描述</th>
                  <th className="w-[138px] px-4 py-3 font-semibold">进度登记时间</th>
                  <th className="sticky right-0 z-10 w-[146px] bg-gray-50 px-4 py-3 font-semibold shadow-[-8px_0_12px_rgba(255,255,255,0.92)]">
                    任务提交
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagination.pagedItems.map((record) => {
                  const isCompleted = record.status === 'completed';
                  const isPendingAcceptance =
                    !isCompleted &&
                    record.latest_progress === 100 &&
                    record.latest_submission_status === 'pending';

                  const statusClass = isCompleted
                    ? 'bg-emerald-100 text-emerald-700'
                    : isPendingAcceptance
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700';

                  const statusLabel = isCompleted ? '已完成' : isPendingAcceptance ? '待验收' : '进行中';

                  return (
                    <tr
                      key={record.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleOpenTask(record.id)}
                    >
                      <td className="px-4 py-4 text-gray-800">
                        <div className="font-medium break-words">{record.title}</div>
                        <div className="mt-1 break-all text-xs text-gray-500">{record.task_no || '未生成任务编号'}</div>
                      </td>
                      <td className="px-4 py-4 break-words text-gray-800">{record.submitter_name}</td>
                      <td className="px-4 py-4 break-words text-gray-800">{record.assignee_name || '-'}</td>
                      <td className="px-4 py-4 text-gray-800">{formatDateTime(record.assigned_at || record.updated_at)}</td>
                      <td className="px-4 py-4 text-gray-800">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                          <span>{formatDateTime(record.expected_deadline)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-800">
                        <ProgressBar progress={record.latest_progress} />
                      </td>
                      <td className="px-4 py-4 text-gray-800">
                        <div className="max-w-[108px] truncate text-sm text-gray-600">
                          {record.latest_progress_description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-800">
                        {record.latest_progress_updated_at ? formatDateTime(record.latest_progress_updated_at) : '-'}
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-4 text-gray-800 shadow-[-8px_0_12px_rgba(255,255,255,0.94)]">
                        {record.assignee_id === user?.id ? (
                          <div className="flex flex-col items-center gap-2">
                            <button
                              onClick={(event) => handleOpenProgressEntry(record.id, event)}
                              className="inline-flex h-[52px] w-[74px] items-center justify-center rounded-lg border border-primary-200 px-2 py-1 text-center text-xs font-medium leading-5 text-primary-700 transition hover:bg-primary-50"
                            >
                              <span>
                                进度
                                <br />
                                填报
                              </span>
                            </button>
                            <button
                              onClick={(event) => handleOpenSubmitResult(record.id, event)}
                              className="inline-flex h-[52px] w-[74px] items-center justify-center rounded-lg bg-primary-600 px-2 py-1 text-center text-xs font-medium leading-5 text-white transition hover:bg-primary-700"
                            >
                              <span>
                                提交
                                <br />
                                结果
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls
            className="mt-4"
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
    </div>
  );
}
