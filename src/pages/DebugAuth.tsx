import { useEffect, useState } from 'react';
import { useAuthStore, loadAuthFromStorage } from '../store/authStore';
import { getAuthHeaders } from '../api/api';

export default function DebugAuth() {
  const [localStorageToken, setLocalStorageToken] = useState('');
  const [storeToken, setStoreToken] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    loadAuthFromStorage();
    
    const tokenFromStorage = localStorage.getItem('token');
    const state = useAuthStore.getState();
    
    setLocalStorageToken(tokenFromStorage || '');
    setStoreToken(state.token || '');
    setIsLoggedIn(state.isLoggedIn);
    
    console.log('=== 认证状态调试 ===');
    console.log('localStorage token:', tokenFromStorage ? '存在' : '不存在');
    console.log('store token:', state.token ? '存在' : '不存在');
    console.log('isLoggedIn:', state.isLoggedIn);
    console.log('getAuthHeaders():', getAuthHeaders());
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">认证状态调试页面</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">认证状态</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">localStorage Token:</span>
              <span className={localStorageToken ? 'text-green-600' : 'text-red-600'}>
                {localStorageToken ? '✅ 存在' : '❌ 不存在'}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">Store Token:</span>
              <span className={storeToken ? 'text-green-600' : 'text-red-600'}>
                {storeToken ? '✅ 存在' : '❌ 不存在'}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">登录状态:</span>
              <span className={isLoggedIn ? 'text-green-600' : 'text-red-600'}>
                {isLoggedIn ? '✅ 已登录' : '❌ 未登录'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">认证头信息</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(getAuthHeaders(), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
