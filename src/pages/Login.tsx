import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, User } from 'lucide-react';
import { login } from '../api/api';
import { useAuthStore } from '../store/authStore';

const brandValues = ['客户第一', '精益求精', '持续创新', '保持温暖'];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login: authLogin } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({ username, password });

      if (result.token && result.user) {
        authLogin(result.token, result.user);
        navigate('/');
      } else {
        setError(result.error || '操作失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,77,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(100,220,255,0.16),transparent_24%)]" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/80 bg-white/92 shadow-[0_36px_80px_rgba(72,73,129,0.18)] xl:grid-cols-[1.08fr_0.92fr]">
        <div className="hidden bg-[radial-gradient(circle_at_top_right,rgba(118,91,255,0.40),transparent_24%),linear-gradient(145deg,#f2f1ff_0%,#f8fbff_72%)] p-10 xl:flex xl:flex-col xl:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <img src="/logo1.png" alt="Allwe" className="h-14 w-auto object-contain" />
              <div>
                <div className="text-[38px] font-semibold tracking-tight text-[#1f2340]">任务集市</div>
                <div className="mt-1 text-sm text-[#8f96b7]">企业内部任务协作平台</div>
              </div>
            </div>

            <div className="mt-12 max-w-[620px]">
              <div className="space-y-3">
                <div className="text-[34px] font-semibold leading-tight text-[#252a48]">做101个印花领航品牌。</div>
                <div className="text-[34px] font-semibold leading-tight text-[#252a48]">为用户提供个性印花。</div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {brandValues.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/80 bg-white/72 px-4 py-2 text-sm font-medium text-[#5f668f] shadow-[0_10px_24px_rgba(95,102,143,0.08)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8 xl:hidden">
              <div className="flex items-center gap-3">
                <img src="/logo1.png" alt="Allwe" className="h-10 w-auto object-contain" />
                <div>
                  <div className="text-[28px] font-semibold tracking-tight text-[#1f2340]">任务集市</div>
                  <div className="text-sm text-[#8a91b3]">企业内部任务协作平台</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#8a91b3]">
                为用户提供个性印花。客户第一，精益求精，持续创新，保持温暖。
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-[30px] font-semibold tracking-tight text-[#252a48]">欢迎回来</h2>
              <p className="mt-2 text-sm text-[#8f96b7]">请输入账号信息后进入平台。账号由主管理员或管理员统一创建。</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#4f5578]">用户名</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9da6c8]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder=""
                    className="form-input pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#4f5578]">密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9da6c8]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="form-input pl-11"
                    required
                  />
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <button type="submit" disabled={loading} className="btn-primary h-12 w-full gap-2">
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>登录中...</span>
                  </>
                ) : (
                  <>
                    <span>登录</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
