import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomeSimple() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      console.log('开始请求...');
      const token = localStorage.getItem('token');
      console.log('Token:', token ? '存在' : '不存在');
      
      const response = await fetch('http://localhost:3000/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('响应状态:', response.status);
      const data = await response.json();
      console.log('响应数据:', data);
      
      if (Array.isArray(data)) {
        console.log('是数组，长度:', data.length);
        setTasks(data);
      } else {
        console.error('不是数组:', data);
        setError('返回数据格式错误');
      }
    } catch (e) {
      console.error('请求失败:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;
  if (error) return <div className="text-center py-12 text-red-600">错误: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏠 简化版任务列表</h1>
      <p className="mb-4">
        <button onClick={() => navigate('/simple')} className="text-blue-600 mr-4">去简单测试页</button>
        <button onClick={fetchData} className="btn-primary">刷新数据</button>
      </p>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p>任务数量: {tasks.length}</p>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无任务</div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="p-4 border rounded shadow">
              <h3 className="font-semibold">{task.title}</h3>
              <p className="text-gray-600 text-sm">{task.description}</p>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{task.status}</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{task.difficulty}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
