import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Clock,
  FileCheck,
  Home,
  KeyRound,
  LogOut,
  Menu,
  PlusCircle,
  Send,
  Settings,
  User,
  X,
} from 'lucide-react';
import { changePassword, getUnreadCount } from '../api/api';
import { useAuthStore } from '../store/authStore';

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isExpert = user?.role === 'expert' || user?.role === 'main_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'main_admin';
  const canReviewResults = user?.role === 'main_admin' || user?.role === 'expert';
  const canSelfChangePassword = Boolean(user);

  const navItems = useMemo(
    () => [
      { path: '/', label: '任务列表', icon: Home },
      { path: '/submit', label: '发布任务', icon: PlusCircle },
      { path: '/result-submit', label: '成果提报', icon: Send },
      { path: '/my-tasks', label: '我的记录', icon: Clock },
      { path: '/public-board', label: '任务公示站', icon: Activity },
      ...(canReviewResults ? [{ path: '/review', label: '审核管理', icon: FileCheck }] : []),
      ...(isExpert ? [{ path: '/task-tracking', label: '全流程跟踪', icon: Activity }] : []),
      ...(isAdmin ? [{ path: '/admin', label: '后台管理', icon: Settings }] : []),
    ],
    [canReviewResults, isAdmin, isExpert]
  );

  const getRoleName = (role?: string) => {
    switch (role) {
      case 'main_admin':
        return '主管理员';
      case 'admin':
        return '管理员';
      case 'expert':
        return '技术专家';
      default:
        return '普通用户';
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchUnreadCount = async () => {
      if (!user) {
        if (mounted) setUnreadCount(0);
        return;
      }

      try {
        const data = await getUnreadCount();
        if (mounted) {
          setUnreadCount(Number(data?.count || 0));
        }
      } catch {
        if (mounted) {
          setUnreadCount(0);
        }
      }
    };

    void fetchUnreadCount();
    const timer = window.setInterval(() => {
      void fetchUnreadCount();
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [location.pathname, user]);

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenPasswordModal = () => {
    resetPasswordForm();
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      window.alert('请完整填写当前密码、新密码和确认密码。');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      window.alert('新密码长度不能少于 6 位。');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.alert('两次输入的新密码不一致。');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordModalOpen(false);
      resetPasswordForm();
      window.alert('密码修改成功，请重新登录。');
      logout();
      navigate('/login');
    } catch (error: any) {
      window.alert(error?.message || '修改密码失败');
    } finally {
      setPasswordSaving(false);
    }
  };

  const SideContent = () => (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <button onClick={() => navigate('/')} className="text-left">
          <div className="flex items-center gap-3">
            <img src="/logo1.png" alt="Allwe" className="h-10 w-auto object-contain" />
            <div>
              <div className="text-[18px] font-semibold text-[#252a48]">任务集市</div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 px-4">
        <div className="space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-gradient-to-r from-[#f2ebff] to-[#f8f2ff] text-[#6e41ff] shadow-sm'
                    : 'text-[#4f5578] hover:bg-[#f7f8ff]'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4 pt-6">
        <div className="page-panel flex items-center gap-3 px-4 py-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#ffc9d9] to-[#fff1f4] text-[#8a4b65]">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#2b3151]">{user?.name}</div>
            <div className="truncate text-xs text-[#8f96b7]">{getRoleName(user?.role)}</div>
          </div>
          {canSelfChangePassword ? (
            <button
              onClick={handleOpenPasswordModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#ebeef8] bg-white text-[#6e41ff] transition hover:bg-[#f7f4ff]"
              title="修改密码"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[274px] border-r border-white/80 bg-white/82 backdrop-blur-xl lg:block">
        <SideContent />
      </aside>

      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/70 bg-white/86 px-4 backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6e9f5] bg-white text-[#4f5578]"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo1.png" alt="Allwe" className="h-8 w-auto object-contain" />
          <span className="text-base font-semibold text-[#2b3151]">任务集市</span>
        </div>
        <div className="flex items-center gap-2">
          {canSelfChangePassword ? (
            <button
              onClick={handleOpenPasswordModal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6e9f5] bg-white text-[#6e41ff]"
              title="修改密码"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          ) : null}
          <button
            onClick={handleLogout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6e9f5] bg-white text-[#ff617d]"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-[#10162f]/24 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="h-full w-[276px] border-r border-white/70 bg-white/96 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SideContent />
          </div>
        </div>
      ) : null}

      <div className="fixed right-8 top-6 z-30 hidden items-center gap-4 lg:flex">
        <button
          onClick={() => navigate('/notifications')}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent text-[#535a7f]"
          title="消息通知"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute right-0 top-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ff617d] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        <div className="flex min-w-[224px] items-center gap-3 rounded-2xl bg-white/72 px-3 py-2 shadow-[0_10px_28px_rgba(44,60,115,0.08)] backdrop-blur-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd1de] to-[#fff1f5] text-[#874962] shadow-sm">
            <User className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-base font-semibold text-[#2b3151]">{user?.name}</div>
            <div className="truncate text-xs text-[#8f96b7]">{getRoleName(user?.role)}</div>
          </div>

          <div className="flex shrink-0 items-center gap-3 pl-1">
            {canSelfChangePassword ? (
              <button
                onClick={handleOpenPasswordModal}
                className="text-[#6e41ff] transition hover:text-[#5b31e6]"
                title="修改密码"
              >
                <KeyRound className="h-[15px] w-[15px]" />
              </button>
            ) : null}
            <button onClick={handleLogout} className="text-[#8f96b7] transition hover:text-[#ff617d]" title="退出登录">
              <LogOut className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>
      </div>

      {passwordModalOpen && canSelfChangePassword ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10162f]/36 p-4">
          <div className="w-full max-w-md rounded-[24px] border border-white/80 bg-white p-6 shadow-[0_28px_80px_rgba(34,42,82,0.18)]">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-[#252a48]">修改密码</h3>
              <p className="mt-1 text-sm text-[#8f96b7]">请输入当前密码，并设置新的登录密码。</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                placeholder="当前密码"
                className="form-input"
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder="新密码"
                className="form-input"
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="确认新密码"
                className="form-input"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setPasswordModalOpen(false);
                  resetPasswordForm();
                }}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button onClick={() => void handleChangePassword()} disabled={passwordSaving} className="btn-primary flex-1">
                {passwordSaving ? '保存中...' : '保存密码'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
