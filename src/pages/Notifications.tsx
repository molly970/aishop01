import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { getNotifications, markAllAsRead, markAsRead, Notification } from '../api/api';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';
import { useAuthStore } from '../store/authStore';

const notificationTypeLabels: Record<string, string> = {
  task_rejected: '审核未通过',
  deadline_reminder: '任务截止提醒',
  overdue: '任务逾期提醒',
  task_assigned: '任务已分配',
  review_completed: '结果审核完成',
  task_reviewed: '任务审核完成',
  task_progress_updated: '任务进度更新',
  submission_created: '任务结果已提交',
  task_claimed: '任务申领提醒',
};

export default function Notifications() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    void fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch {
      console.error('标记已读失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAllRead) return;

    setMarkingAllRead(true);
    try {
      await markAllAsRead();
      await fetchNotifications();
    } catch {
      console.error('一键已读失败');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'review_completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'deadline_reminder':
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-primary-500" />;
    }
  };

  const getNotificationTarget = (notification: Notification) => {
    const taskPath = notification.task_id ? `/task/${notification.task_id}` : '/notifications';
    const isReviewer = user?.role === 'main_admin' || user?.role === 'expert';

    switch (notification.type) {
      case 'task_claimed':
        return isReviewer ? '/review?tab=claims' : taskPath;
      case 'review_completed':
        return '/my-tasks?tab=submissions';
      case 'task_rejected':
        if (notification.title.includes('结果')) {
          return '/my-tasks?tab=submissions';
        }
        return '/my-tasks?tab=tasks';
      case 'task_reviewed':
        return '/my-tasks?tab=tasks';
      case 'submission_created':
        return isReviewer ? '/review?tab=submissions&status=pending' : taskPath;
      case 'task_assigned':
        if (notification.title === '任务已分配') {
          return '/result-submit';
        }
        if (notification.title.includes('分配有新')) {
          return '/public-board';
        }
        return taskPath;
      case 'task_progress_updated':
        return '/public-board';
      case 'deadline_reminder':
      case 'overdue':
      default:
        return taskPath;
    }
  };

  const handleOpenNotification = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    navigate(getNotificationTarget(notification));
  };

  const hasUnread = notifications.some((item) => !item.is_read);
  const pagination = usePagination(notifications, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">通知消息</h1>
            {hasUnread ? (
              <button
                onClick={() => void handleMarkAllAsRead()}
                disabled={markingAllRead}
                className="btn-secondary min-w-[96px] text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingAllRead ? '处理中...' : '一键已读'}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-gray-500">查看您的系统通知</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card py-12 text-center">
          <Bell className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">暂无通知</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.pagedItems.map((notification) => (
            <div
              key={notification.id}
              className={`card cursor-pointer transition-colors hover:bg-gray-50 ${
                !notification.is_read ? 'border-l-4 border-primary-500 bg-blue-50' : ''
              }`}
              onClick={() => void handleOpenNotification(notification)}
            >
              <div className="flex items-start space-x-4">
                <div className="mt-1 flex-shrink-0">{getIcon(notification.type)}</div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-800">
                      {notificationTypeLabels[notification.type] || notification.title}
                    </h3>
                    {!notification.is_read ? <div className="h-2 w-2 rounded-full bg-primary-500" /> : null}
                  </div>
                  <p className="mb-2 text-sm text-gray-600">{notification.content}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="mr-1 h-3 w-3" />
                    {formatDate(notification.created_at)}
                  </div>
                </div>
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
