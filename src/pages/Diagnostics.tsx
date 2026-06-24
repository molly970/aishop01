import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function Diagnostics() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { token, user } = useAuthStore();

  const addResult = (msg: string) => {
    setResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);

    // 1. 检查本地存储
    addResult('=== 开始诊断 ===');
    addResult(`Token存在: ${!!token}`);
    addResult(`Token值: ${token ? token.substring(0, 30) + '...' : '无'}`);
    addResult(`用户信息: ${user ? `${user.name} (${user.role})` : '无'}`);

    // 2. 测试健康检查
    addResult('\n--- 测试后端连接 ---');
    try {
      const healthRes = await fetch('http://localhost:3000/api/health');
      addResult(`健康检查状态: ${healthRes.status}`);
      if (healthRes.ok) {
        addResult('✓ 后端连接正常');
      } else {
        addResult('✗ 后端连接失败');
      }
    } catch (e: any) {
      addResult(`✗ 无法连接后端: ${e.message}`);
    }

    // 3. 测试登录
    addResult('\n--- 测试登录 ---');
    try {
      const loginRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user', password: 'user123' })
      });
      const loginData = await loginRes.json();
      if (loginData.token) {
        addResult('✓ 登录成功');
        addResult(`获取到新Token: ${loginData.token.substring(0, 30)}...`);
        
        // 4. 测试获取任务（使用新Token）
        addResult('\n--- 测试获取任务 ---');
        const tasksRes = await fetch('http://localhost:3000/api/tasks', {
          headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        addResult(`获取任务状态: ${tasksRes.status}`);
        
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          addResult(`✓ 获取成功，任务数量: ${Array.isArray(tasks) ? tasks.length : '非数组'}`);
          
          if (Array.isArray(tasks)) {
            tasks.slice(0, 5).forEach((task: any) => {
              addResult(`  - [${task.status}] ${task.title}`);
            });
          }
        } else {
          addResult('✗ 获取任务失败');
          const errorText = await tasksRes.text();
          addResult(`错误信息: ${errorText}`);
        }
      } else {
        addResult('✗ 登录失败');
        addResult(`响应: ${JSON.stringify(loginData)}`);
      }
    } catch (e: any) {
      addResult(`✗ 测试失败: ${e.message}`);
    }

    addResult('\n=== 诊断完成 ===');
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">🔧 API诊断工具</h1>
        
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="btn-primary mb-4"
        >
          {loading ? '诊断中...' : '运行诊断'}
        </button>

        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-500">点击"运行诊断"开始测试...</p>
          ) : (
            results.map((result, i) => (
              <div key={i} className="mb-1 whitespace-pre-wrap">{result}</div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-bold text-blue-800 mb-2">诊断说明：</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 检查浏览器控制台(F12)获取更多信息</li>
            <li>• 诊断会自动测试登录和获取任务API</li>
            <li>• 红色文字表示出现问题，绿色表示正常</li>
            <li>• 如果所有测试通过但仍看不到任务，请刷新页面</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
