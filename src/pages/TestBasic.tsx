import { useState } from 'react';

export default function TestBasic() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">测试页面</h1>
        <p className="text-gray-600 mb-6">这是一个简单的测试页面，用于验证前端渲染是否正常</p>
        <div className="flex items-center gap-4 mb-6">
          <span className="text-3xl font-bold text-blue-500">{count}</span>
          <button
            onClick={() => setCount(count + 1)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            点击增加
          </button>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-500">如果能看到这个页面，说明前端渲染正常工作</p>
        </div>
      </div>
    </div>
  );
}
