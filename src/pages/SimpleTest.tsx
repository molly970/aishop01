import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function SimpleTest() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const testAPI = async () => {
    setLoading(true);
    setResult('开始测试...\n');
    try {
      addLog('1. 准备测试...');
      const myToken = token || localStorage.getItem('token');
      addLog(`Token: ${myToken ? '存在' : '不存在'}`);
      
      addLog('\n2. 调用API...');
      const response = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${myToken}` }
      });
      
      addLog(`响应状态: ${response.status}`);
      
      const data = await response.json();
      addLog(`响应: ${JSON.stringify(data, null, 2)}`);
      
      if (Array.isArray(data)) {
        addLog(`\n✅ 成功! 共 ${data.length} 个任务`);
        data.forEach((t, i) => addLog(`${i+1}. ${t.title} (${t.status})`));
      } else {
        addLog('\n❌ 响应不是数组!');
      }
    } catch (e) {
      addLog(`\n❌ 错误: ${e}`);
    }
    setLoading(false);
  };

  const addLog = (text) => {
    setResult(prev => prev + text + '\n');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔍 简单测试页面</h1>
      <button 
        onClick={testAPI} 
        disabled={loading}
        className="btn-primary mr-2 mb-4"
      >
        {loading ? '测试中...' : '开始测试'}
      </button>
      <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">{result}</pre>
    </div>
  );
}
