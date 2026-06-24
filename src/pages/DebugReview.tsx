import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getReviewedTasks, getPendingTasks } from '../api/api';

export default function DebugReview() {
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [reviewedTasks, setReviewedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('=== 开始获取数据 ===');
      
      // 获取待审核任务
      console.log('1. 调用 getPendingTasks()...');
      const pending = await getPendingTasks();
      console.log('待审核任务返回数据:', pending);
      console.log('数据类型:', typeof pending);
      console.log('是否数组:', Array.isArray(pending));
      if (Array.isArray(pending)) {
        console.log('待审核任务数量:', pending.length);
      }
      setPendingTasks(pending);
      
      // 获取已审核任务
      console.log('2. 调用 getReviewedTasks()...');
      const reviewed = await getReviewedTasks();
      console.log('已审核任务返回数据:', reviewed);
      console.log('数据类型:', typeof reviewed);
      console.log('是否数组:', Array.isArray(reviewed));
      if (Array.isArray(reviewed)) {
        console.log('已审核任务数量:', reviewed.length);
        reviewed.forEach((task: any, index: number) => {
          console.log(`任务 ${index + 1}:`, {
            id: task.id,
            title: task.title,
            status: task.status,
            task_no: task.task_no
          });
        });
      }
      setReviewedTasks(reviewed);
      
    } catch (e: any) {
      console.error('获取数据失败:', e);
      setError(e.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">审核数据调试页面</h1>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-2xl">加载中...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">审核数据调试页面</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>错误:</strong> {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">待审核任务</h2>
          <p className="text-gray-600 mb-4">数据长度: {pendingTasks.length}</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(pendingTasks, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">已审核任务</h2>
          <p className="text-gray-600 mb-4">数据长度: {reviewedTasks.length}</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(reviewedTasks, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
