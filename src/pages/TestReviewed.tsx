import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getReviewedTasks } from '../api/api';

export default function TestReviewedTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuthStore();
  
  useEffect(() => {
    if (!user) return;
    
    fetchReviewedTasks();
  }, [user]);
  
  const fetchReviewedTasks = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('=== 测试获取已审核任务 ===');
      const data = await getReviewedTasks();
      console.log('返回数据:', data);
      console.log('数据类型:', typeof data);
      console.log('是否数组:', Array.isArray(data));
      console.log('数据长度:', data.length);
      
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        setError('返回数据不是数组');
        setTasks([]);
      }
    } catch (e: any) {
      console.error('获取数据失败:', e);
      setError(e.message || '获取数据失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">错误: {error}</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">已审核任务测试页面</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">测试结果</h2>
          <p className="text-gray-600 mb-4">已审核任务数量: <span className="font-bold text-blue-600">{tasks.length}</span></p>
          
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">暂无已审核任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.status === 'published' ? 'bg-green-100 text-green-700' :
                      task.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {task.status === 'published' ? '已通过' : task.status === 'cancelled' ? '已拒绝' : task.status}
                    </span>
                    <span className="text-xs text-gray-500">{task.task_no}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800">{task.title}</h3>
                  <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                  <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                    <span>提交者: {task.submitter_name}</span>
                    <span>评分: {task.rating}星</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">原始数据</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(tasks, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
