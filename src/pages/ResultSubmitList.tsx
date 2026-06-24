import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, Send, Trophy, User } from 'lucide-react';
import { getMyTasks, Task } from '../api/api';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';
import { useAuthStore } from '../store/authStore';

const statusLabels: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  claimed: '待指派',
  assigned: '已分配',
  completed: '已完成',
  cancelled: '未通过，请联系管理员',
};

export default function ResultSubmitList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const pagination = usePagination(tasks, [tasks.length]);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getMyTasks();
      const assignedTasks = Array.isArray(data)
        ? data.filter(
            (task: Task) =>
              (task.status === 'assigned' || task.status === 'completed') && task.assignee_id === user?.id
          )
        : [];
      setTasks(assignedTasks);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const openProgressEntry = (taskId: string) => {
    navigate(`/task/${taskId}?mode=progress`, {
      state: { backTo: '/result-submit', backLabel: '返回成果提报' },
    });
  };

  const openSubmitResult = (taskId: string) => {
    navigate(`/submit-result/${taskId}`, {
      state: { backTo: '/result-submit', backLabel: '返回成果提报' },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">成果提报</h1>
        <p className="mt-1 text-gray-500">查看分配给您的任务，并直接进行进度登记和结果提交</p>
      </div>

      {tasks.length === 0 ? (
        <div className="card py-12 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">暂无需要提报成果的任务</p>
          <p className="mt-2 text-sm text-gray-400">当您被分配任务后，任务会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.pagedItems.map((task) => (
            <div key={task.id} className="card transition-shadow hover:shadow-lg">
              <div className="mb-3 flex items-start justify-between">
                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                  {statusLabels[task.status] || task.status}
                </span>
                <div className="flex items-center text-yellow-600">
                  <Trophy className="mr-1 h-4 w-4" />
                  <span className="font-medium">{task.reward} 澳维豆</span>
                </div>
              </div>

              {task.task_no ? <div className="mb-2 text-xs text-gray-500">{task.task_no}</div> : null}

              <h3 className="mb-2 text-lg font-semibold text-gray-800">{task.title}</h3>
              <p className="mb-3 line-clamp-2 text-sm text-gray-600">{task.description}</p>

              <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center">
                  <User className="mr-1 h-4 w-4" />
                  任务发布方：{task.submitter_name}
                </span>
                <span className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  任务时限：{formatDate(task.expected_deadline)}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => openProgressEntry(task.id)} className="btn-secondary">
                  登记进度
                </button>
                <button onClick={() => openSubmitResult(task.id)} className="btn-primary flex items-center space-x-2">
                  <Send className="h-4 w-4" />
                  <span>提交结果</span>
                </button>
              </div>
            </div>
          ))}
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}
    </div>
  );
}
