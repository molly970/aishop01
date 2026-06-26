import { useAuthStore } from '../store/authStore';

const BASE_URL = '/api';

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  is_disabled?: number;
  disabled_at?: string | null;
  disabled_by?: string | null;
  disabled_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  task_no?: string;
  title: string;
  description: string;
  type: string;
  reward: number;
  reward_type?: string;
  reward_item?: string;
  difficulty: string;
  expected_deadline: string;
  priority: string;
  rating: number;
  status: string;
  submitter_id: string;
  submitter_name: string;
  assignee_id?: string;
  assignee_name?: string;
  assigned_at?: string;
  is_publicized?: number;
  latest_progress?: number;
  latest_progress_description?: string;
  latest_progress_updated_at?: string;
  latest_submission_status?: string;
  review_comment?: string;
  is_deleted?: number;
  deleted_at?: string;
  deleted_by?: string;
  deleted_by_name?: string;
  remainingDays?: number;
  created_at: string;
  updated_at: string;
  claimCount?: number;
  claims?: Claim[];
  submissions?: Submission[];
  progressLogs?: TaskProgressLog[];
}

export interface TaskProgressLog {
  id: string;
  task_id: string;
  progress: number;
  description?: string;
  updater_id: string;
  updater_name: string;
  created_at: string;
}

export interface Claim {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  status: string;
  claimed_at: string;
}

export interface MyClaimTask extends Task {
  claim_id: string;
  claim_status: string;
  claimed_at: string;
  application_status: string;
}

export interface Submission {
  id: string;
  task_id: string;
  task_no: string;
  submitter_id: string;
  submitter_name: string;
  description?: string;
  ai_tool?: string;
  prompt?: string;
  usage_guide?: string;
  commitment: boolean;
  status: string;
  review_comment?: string;
  rating?: number;
  rating_type?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  files?: FileRecord[];
}

export interface FileRecord {
  id: string;
  submission_id?: string;
  task_id?: string;
  file_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id?: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action_type: string;
  action_detail: string;
  target_id?: string;
  target_type?: string;
  created_at: string;
}

export interface BatchImportUsersResult {
  message: string;
  createdUsers: User[];
  skipped: string[];
}

const getAuthHeaders = () => {
  const state = useAuthStore.getState();
  const token = state.token || localStorage.getItem('token');
  console.log('获取Token:', token ? '成功' : '失败');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

// Auth
export const register = async (data: { username: string; password: string; name: string }) => {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const login = async (data: { username: string; password: string }) => {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const getCurrentUser = async () => {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '获取当前用户信息失败');
  }
  return data;
};

export const logout = async () => {
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
  const response = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || '修改密码失败');
  }
  return result;
};

// Tasks
export const getTasks = async (params?: { status?: string; type?: string; search?: string }) => {
  console.log('=== 调用 getTasks (无认证) ===');
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
  }
  const query = searchParams.toString();
  const response = await fetch(`${BASE_URL}/tasks${query ? '?' + query : ''}`);
  console.log('getTasks 响应状态:', response.status);
  if (!response.ok) {
    console.error('API Error:', response.status, response.statusText);
    return { error: '获取任务失败' };
  }
  const data = await response.json();
  console.log('getTasks 返回数据:', data);
  return data;
};

export const getMyTasks = async () => {
  const response = await fetch(`${BASE_URL}/tasks/my`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getMyClaims = async () => {
  const response = await fetch(`${BASE_URL}/tasks/my-claims`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getPendingTasks = async (search?: string) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  const query = params.toString();
  const response = await fetch(`${BASE_URL}/tasks/pending${query ? '?' + query : ''}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getReviewedTasks = async (params?: { search?: string; status?: string }) => {
  const searchParams = new URLSearchParams();
  if (params) {
    if (params.search) searchParams.append('search', params.search);
    if (params.status) searchParams.append('status', params.status);
  }
  const query = searchParams.toString();
  const response = await fetch(`${BASE_URL}/tasks/reviewed${query ? '?' + query : ''}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getClaimedTasks = async () => {
  const response = await fetch(`${BASE_URL}/tasks/claims`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getPublicBoardTasks = async () => {
  const token = useAuthStore.getState().token || localStorage.getItem('token');
  const response = await fetch(`${BASE_URL}/tasks/public-board`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '获取公示任务失败');
  }
  return data;
};

export const setTaskPublicity = async (id: string, isPublicized: boolean) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/publicity`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ isPublicized }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '设置任务公示状态失败');
  }
  return data;
};

export const getTaskById = async (id: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const createTaskProgress = async (id: string, data: { progress: number; description?: string }) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || '登记任务进度失败');
  }
  return result;
};

export const createTask = async (data: {
  title: string;
  description: string;
  type: string;
  reward: number;
  reward_type?: string;
  reward_item?: string;
  difficulty: string;
  expected_deadline: string;
  priority?: string;
}) => {
  const response = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const reviewTask = async (id: string, data: { approved: boolean; comment?: string; ratings?: string }) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const claimTask = async (id: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const assignTask = async (id: string, claimId: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/assign`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ claimId }),
  });
  return response.json();
};

export const reissueTask = async (id: string, expected_deadline?: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/reissue`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ expected_deadline }),
  });
  return response.json();
};

export const getTaskClaims = async (id: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}/claims`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const deleteTask = async (id: string) => {
  const response = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '删除任务失败');
  }
  return data;
};

export const batchDeleteTasks = async (ids: string[]) => {
  const response = await fetch(`${BASE_URL}/tasks/batch-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ ids }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '批量删除任务失败');
  }
  return data;
};

export const getDeletedTasks = async () => {
  const response = await fetch(`${BASE_URL}/tasks/recycle-bin`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '获取任务回收站失败');
  }
  return data;
};

// Submissions
export const createSubmission = async (data: {
  task_id: string;
  task_no: string;
  description?: string;
  ai_tool?: string;
  prompt?: string;
  usage_guide?: string;
  commitment: boolean;
  resultFile?: File;
  screenshots?: File[];
}) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (key === 'resultFile' && value instanceof File) {
        formData.append('result', value);
      } else if (key === 'screenshots' && Array.isArray(value)) {
        value.forEach(file => formData.append('screenshots', file));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  const response = await fetch(`${BASE_URL}/submissions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return response.json();
};

export const getSubmissionsByTask = async (taskId: string) => {
  const response = await fetch(`${BASE_URL}/submissions/task/${taskId}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getMySubmissions = async () => {
  const response = await fetch(`${BASE_URL}/submissions/my`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getAllSubmissions = async () => {
  const response = await fetch(`${BASE_URL}/submissions`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getSubmissionById = async (id: string) => {
  const response = await fetch(`${BASE_URL}/submissions/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const reviewSubmission = async (id: string, data: { approved: boolean; review_comment?: string; ratings?: string }) => {
  const response = await fetch(`${BASE_URL}/submissions/${id}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const deleteSubmission = async (id: string) => {
  const response = await fetch(`${BASE_URL}/submissions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '删除审核结果失败');
  }
  return data;
};

// Notifications
export const getNotifications = async () => {
  const response = await fetch(`${BASE_URL}/notifications`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getUnreadCount = async () => {
  const response = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const markAsRead = async (id: string) => {
  const response = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const markAllAsRead = async () => {
  const response = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  return response.json();
};

// Admin
export const getUsers = async () => {
  const response = await fetch(`${BASE_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const createAdminUser = async (data: { username: string; name: string; password: string; role: string }) => {
  const response = await fetch(`${BASE_URL}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || '新增用户失败');
  }
  return result;
};

export const exportUsers = async () => {
  const response = await fetch(`${BASE_URL}/admin/users/export`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = '导出用户失败';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }
  return response.blob();
};

export const importUsers = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/admin/users/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const data: BatchImportUsersResult | { error?: string } = await response.json();
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || '批量导入用户失败');
  }
  return data as BatchImportUsersResult;
};

export const updateUserRole = async (id: string, role: string) => {
  const response = await fetch(`${BASE_URL}/admin/users/${id}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ role }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '更新用户角色失败');
  }
  return data;
};

export const resetUserPassword = async (id: string, password?: string) => {
  const response = await fetch(`${BASE_URL}/admin/users/${id}/reset-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(password ? { password } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '重置密码失败');
  }
  return data;
};

export const updateUserDisabled = async (id: string, disabled: boolean) => {
  const response = await fetch(`${BASE_URL}/admin/users/${id}/disabled`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ disabled }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '更新用户状态失败');
  }
  return data;
};

export const deleteUser = async (id: string) => {
  const response = await fetch(`${BASE_URL}/admin/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '删除账号失败');
  }
  return data;
};

export const batchDeleteUsers = async (ids: string[]) => {
  const response = await fetch(`${BASE_URL}/admin/users/batch-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ ids }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '批量删除账号失败');
  }
  return data;
};

export const getAdmins = async () => {
  const response = await fetch(`${BASE_URL}/admin/admins`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const getAdminLogs = async () => {
  const response = await fetch(`${BASE_URL}/admin/logs`, {
    headers: getAuthHeaders(),
  });
  return response.json();
};

export const initTestData = async () => {
  const response = await fetch(`${BASE_URL}/admin/init-test-data`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
};
