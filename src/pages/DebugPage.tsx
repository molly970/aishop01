import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const { token, user, isLoggedIn } = useAuthStore();

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    addLog('页面加载');
    addLog(`Token状态: ${token ? '存在' : '不存在'}`);
    addLog(`用户状态: ${user ? JSON.stringify(user) : '无'}`);
    addLog(`登录状态: ${isLoggedIn ? '已登录' : '未登录'}`);
  }, [token, user, isLoggedIn]);

  const testGetTasks = async () => {
    try {
      addLog('开始测试获取任务...');
      
      const state = useAuthStore.getState();
      const myToken = state.token || localStorage.getItem('token');
      addLog(`使用Token: ${myToken ? myToken.substring(0, 30) + '...' : '无'}`);
      addLog('不发送认证头部，直接请求...');
      
      const response = await fetch('http://localhost:3000/api/tasks');
      
      addLog(`响应状态: ${response.status}`);
      
      const data = await response.json();
      addLog(`数据类型: ${typeof data}，是数组: ${Array.isArray(data)}`);
      
      if (Array.isArray(data)) {
        addLog(`任务数量: ${data.length}`);
        data.forEach((task, i) => {
          addLog(`  ${i + 1}. [${task.status}] ${task.title}`);
        });
      } else {
        addLog('数据: ' + JSON.stringify(data));
      }
    } catch (error: any) {
      addLog('错误: ' + error.message);
    }
  };

  const testLogin = async () => {
    try {
      addLog('尝试登录...');
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user', password: 'user123' })
      });
      const data = await response.json();
      addLog('登录响应: ' + JSON.stringify(data));
    } catch (error: any) {
      addLog('登录错误: ' + error.message);
    }
  };

  const testServer = async () => {
    try {
      console.log('=== testServer 被调用 ===');
      addLog('开始测试后端服务器 (2025-05-22)...');
      const response = await fetch('http://localhost:3000/api/test');
      console.log('testServer 响应状态:', response.status);
      addLog(`响应状态: ${response.status}`);
      const data = await response.json();
      console.log('testServer 响应数据:', data);
      addLog('响应: ' + JSON.stringify(data));
    } catch (error: any) {
      console.log('testServer 错误:', error);
      addLog('错误: ' + error.message);
    }
  };

  const testInitData = async () => {
    try {
      addLog('开始初始化测试数据...');
      
      const state = useAuthStore.getState();
      const myToken = state.token || localStorage.getItem('token');
      
      const response = await fetch('http://localhost:3000/api/admin/init-test-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${myToken}`
        }
      });
      
      addLog(`响应状态: ${response.status}`);
      
      const data = await response.json();
      addLog('响应: ' + JSON.stringify(data));
      
      if (data.message) {
        addLog('✅ 测试数据初始化成功！');
      }
    } catch (error: any) {
      addLog('错误: ' + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">调试页面</h1>
        
        <div className="flex gap-4 mb-6">
        <button onClick={testLogin} className="btn-primary">测试登录</button>
        <button onClick={testServer} className="btn-primary">测试后端</button>
        <button onClick={testGetTasks} className="btn-primary">测试获取任务</button>
        <button onClick={testInitData} className="btn-secondary">初始化测试数据</button>
      </div>

        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">当前状态</h3>
          <p>Token: {token ? '✓' : '✗'}</p>
          <p>用户: {user ? user.name : '无'}</p>
          <p>角色: {user ? user.role : '无'}</p>
        </div>

        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
