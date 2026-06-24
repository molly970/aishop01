import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimTask, getMyClaims, getMyTasks, getTasks, MyClaimTask, Task } from '../api/api';
import { useAuthStore } from '../store/authStore';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock3,
  Gift,
  LayoutGrid,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';

const typeTabs = [
  { value: 'all', label: '全部' },
  { value: 'ai_research', label: '推荐' },
  { value: 'model_training', label: 'AI 训练' },
  { value: 'data_analysis', label: '数据处理' },
  { value: 'other', label: '内容生成' },
  { value: 'design', label: '设计创意' },
  { value: 'dev', label: '开发任务' },
];

const typeLabelMap: Record<string, string> = {
  ai_research: 'AI 训练',
  model_training: 'AI 训练',
  data_analysis: '数据处理',
  other: '内容生成',
  design: '设计创意',
  dev: '开发任务',
};

const difficultyLabels: Record<string, string> = {
  simple: '简单',
  medium: '中等',
  complex: '复杂',
};

const designKeywords = ['设计', '创意', '视觉', '海报', 'logo', '品牌', '界面', 'ui', '插画'];
const devKeywords = ['开发', '系统', '前端', '后端', '接口', '代码', '程序', '功能', '部署', '调试'];

const matchesKeywordCategory = (task: Task, keywords: string[]) => {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
};

const matchesFilterType = (task: Task, filterType: string) => {
  if (filterType === 'all') return true;
  if (filterType === 'design') {
    return task.type === 'design' || (task.type === 'other' && matchesKeywordCategory(task, designKeywords));
  }
  if (filterType === 'dev') {
    return (
      task.type === 'dev' ||
      ((task.type === 'other' || task.type === 'ai_research') && matchesKeywordCategory(task, devKeywords))
    );
  }
  return task.type === filterType;
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [summaryTasks, setSummaryTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimedTaskIds, setClaimedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchTasks();
    void fetchSummaryData();
    void fetchClaimedTasks();
  }, [search, filterType]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTasks({
        type: filterType !== 'all' && filterType !== 'design' && filterType !== 'dev' ? filterType : undefined,
        search: search || undefined,
      });

      if (data && data.error) {
        setError(data.error);
        setTasks([]);
      } else if (Array.isArray(data)) {
        setTasks(data.filter((task) => matchesFilterType(task, filterType)));
      } else {
        setError('数据格式不正确');
        setTasks([]);
      }
    } catch (fetchError: any) {
      setError(fetchError.message || '网络错误，请稍后重试。');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaimedTasks = async () => {
    if (!user) return;
    try {
      const claimData = await getMyClaims();
      const safeClaims = Array.isArray(claimData) ? claimData : [];
      const claimed = safeClaims.map((task: MyClaimTask) => task.id);
      setClaimedTaskIds(new Set(claimed));
    } catch {
      setClaimedTaskIds(new Set());
    }
  };

  const fetchSummaryData = async () => {
    try {
      const [availableTaskData, myTaskData] = await Promise.all([
        getTasks(),
        user ? getMyTasks() : Promise.resolve([]),
      ]);

      setSummaryTasks(Array.isArray(availableTaskData) ? availableTaskData : []);
      setMyTasks(Array.isArray(myTaskData) ? myTaskData : []);
    } catch {
      setSummaryTasks([]);
      setMyTasks([]);
    }
  };

  const handleClaim = async (taskId: string) => {
    setClaiming(taskId);
    try {
      await claimTask(taskId);
      await fetchTasks();
      await fetchClaimedTasks();
    } finally {
      setClaiming(null);
    }
  };

  const parseRatings = (ratingsStr?: string) => {
    if (!ratingsStr) return { application: 0, product: 0, engineering: 0 };
    const result: Record<string, number> = { application: 0, product: 0, engineering: 0 };
    ratingsStr.split(',').forEach((part) => {
      const [key, value] = part.split(':');
      if (key && value) {
        result[key.trim()] = parseInt(value.trim(), 10);
      }
    });
    return result;
  };

  const formatDeadline = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('zh-CN');
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 3 }).map((_, index) => (
      <Star
        key={index}
        className={`h-3.5 w-3.5 ${
          index < rating ? 'fill-[#ffbf55] text-[#ffbf55]' : 'text-[#d7dcf0]'
        }`}
      />
    ));

  const summary = useMemo(() => {
    const today = new Date().toLocaleDateString('zh-CN');
    const newTasks = summaryTasks.filter((task) => {
      const createdAt = new Date(task.created_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt.toLocaleDateString('zh-CN') === today;
    }).length;

    const assigned = myTasks.filter(
      (task) => task.status === 'assigned' && task.assignee_id === user?.id
    ).length;
    const completed = myTasks.filter(
      (task) => task.status === 'completed' && task.assignee_id === user?.id
    ).length;
    const points = myTasks
      .filter((task) => task.status === 'completed' && task.assignee_id === user?.id)
      .reduce((sum, task) => sum + (task.reward || 0), 0);

    return {
      newTasks,
      assigned,
      completed,
      points,
    };
  }, [summaryTasks, myTasks, user?.id]);

  const quickLinks = [
    { label: '发布任务', path: '/submit', icon: Sparkles },
    { label: '成果提报', path: '/result-submit', icon: Send },
    { label: '我的记录', path: '/my-tasks', icon: LayoutGrid },
    { label: '任务公示站', path: '/public-board', icon: Users },
    { label: '审核管理', path: '/review', icon: ShieldCheck, show: user?.role === 'main_admin' || user?.role === 'expert' },
    { label: '全流程跟踪', path: '/task-tracking', icon: Zap, show: user?.role === 'main_admin' || user?.role === 'admin' || user?.role === 'expert' },
  ].filter((item) => item.show !== false);

  const scrollToTaskList = () => {
    const taskList = document.getElementById('home-task-list');
    taskList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tasksPagination = usePagination(tasks, [search, filterType]);

  return (
    <div className="space-y-5">
      <section className="px-0 pt-0">
        <div className="flex flex-col gap-4">
          <div className="relative w-full max-w-[808px]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#adb4d1]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务、技能或关键词..."
              className="form-input h-[56px] rounded-[18px] border-white/80 bg-white/85 pl-11 shadow-[0_14px_32px_rgba(79,88,145,0.06)]"
            />
          </div>
        </div>
      </section>

      <section className="page-panel relative overflow-hidden px-8 py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(149,128,255,0.32),transparent_16%),radial-gradient(circle_at_60%_52%,rgba(136,237,255,0.28),transparent_15%),linear-gradient(135deg,#f3f1ff_0%,#f7fbff_58%,#f7ebff_100%)]" />
        <div className="absolute bottom-2 left-[22%] h-20 w-[42%] rounded-[999px] bg-gradient-to-r from-[#fddcff] via-[#dde2ff] to-[#c6f8ff] opacity-80 blur-xl" />

        <div className="relative grid items-start gap-5 xl:grid-cols-[1fr_300px]">
          <div className="py-3">
            <h1 className="mt-1 text-[34px] font-semibold tracking-tight text-[#26294a] sm:text-[42px]">
              让 <span className="text-[#6f47ff]">AI</span> 赋能创意
            </h1>
            <p className="mt-3 max-w-xl text-[16px] leading-8 text-[#7f86a8]">
              探索前沿任务，释放无限创造力
            </p>

            <div className="pointer-events-none absolute right-[30%] top-7 hidden h-40 w-40 rounded-full border border-white/60 bg-gradient-to-br from-white/90 to-[#daf2ff]/60 shadow-[0_18px_50px_rgba(116,102,255,0.18)] lg:block" />
            <div className="pointer-events-none absolute right-[36%] top-[92px] hidden h-24 w-24 rounded-full border border-white/60 bg-gradient-to-br from-[#ffd6ff]/70 to-[#d6f1ff]/80 shadow-[0_18px_50px_rgba(116,102,255,0.20)] lg:block" />
            <div className="pointer-events-none absolute right-[18%] top-4 hidden h-32 w-32 rounded-full border border-white/70 bg-gradient-to-br from-white to-[#c9f3ff]/70 shadow-[0_18px_50px_rgba(91,179,255,0.18)] lg:block" />
            <div className="pointer-events-none absolute right-[24%] top-[120px] hidden h-[110px] w-[250px] rounded-[999px] bg-gradient-to-r from-[#f4d7ff]/70 via-[#d9ddff]/70 to-[#b9f4ff]/70 blur-md lg:block" />
          </div>

          <div className="relative">
            <div className="page-panel border-white/80 bg-white/84 p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#6b56ff]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-[#8a91b3]">今日新增任务</div>
                    <button
                      onClick={scrollToTaskList}
                      className="text-[18px] font-semibold text-[#26294a] transition hover:text-primary-600"
                    >
                      {summary.newTasks}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f2efff] text-[#7d6fff]">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-[#8a91b3]">进行中任务</div>
                    <button
                      onClick={() => navigate('/my-tasks?tab=tasks')}
                      className="text-[18px] font-semibold text-[#26294a] transition hover:text-primary-600"
                    >
                      {summary.assigned}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf7ff] text-[#4d98ff]">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-[#8a91b3]">已完成任务</div>
                    <button
                      onClick={() => navigate('/my-tasks?tab=submissions')}
                      className="text-[18px] font-semibold text-[#26294a] transition hover:text-primary-600"
                    >
                      {summary.completed}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff6df] text-[#f0a92b]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-[#8a91b3]">我的澳维豆</div>
                    <button
                      onClick={() => navigate('/my-tasks?tab=beans')}
                      className="text-[18px] font-semibold text-[#26294a] transition hover:text-primary-600"
                    >
                      {summary.points}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="home-task-list" className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="page-panel px-4 py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                {typeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setFilterType(tab.value)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      filterType === tab.value
                        ? 'border border-[#8161ff] bg-[#f7f2ff] text-[#6f47ff]'
                        : 'text-[#676e95] hover:bg-[#f7f8ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {error && (
            <div className="page-panel flex items-start gap-3 border border-red-100 bg-red-50 px-5 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <div className="font-medium text-red-700">加载失败</div>
                <div className="mt-1 text-sm text-red-600">{error}</div>
              </div>
              <button onClick={() => void fetchTasks()} className="btn-secondary ml-auto text-sm">
                重试
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#7c4dff] border-t-transparent" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="page-panel py-16 text-center">
              <Zap className="mx-auto mb-4 h-14 w-14 text-[#d3d8ed]" />
              <div className="text-lg font-medium text-[#26294a]">暂无匹配任务</div>
              <div className="mt-2 text-sm text-[#8b93b6]">可以尝试其他分类，或者稍后再看看。</div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {tasksPagination.pagedItems.map((task) => {
                const ratings = parseRatings(task.ratings);
                const claimed = claimedTaskIds.has(task.id);

                return (
                  <article
                    key={task.id}
                    className="page-panel flex h-full cursor-pointer flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(92,96,160,0.12)]"
                    onClick={() =>
                      navigate(`/task/${task.id}`, {
                        state: { backTo: '/', backLabel: '返回任务列表' },
                      })
                    }
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="rounded-full bg-[#f2efff] px-3 py-1 text-xs font-medium text-[#7a5bff]">
                        {typeLabelMap[task.type] || '推荐'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          task.difficulty === 'simple'
                            ? 'bg-[#e9fbef] text-[#4ab56e]'
                            : task.difficulty === 'medium'
                              ? 'bg-[#fff5df] text-[#e1a43d]'
                              : 'bg-[#fff0ef] text-[#ff7d73]'
                        }`}
                      >
                        {difficultyLabels[task.difficulty]}
                      </span>
                    </div>

                    <h3 className="text-[17px] font-semibold leading-8 text-[#252a48]">{task.title}</h3>
                    <p className="mt-2 line-clamp-2 min-h-[52px] text-sm leading-7 text-[#7f86a8]">{task.description}</p>

                    <div className="mt-4 flex items-center gap-4 text-sm text-[#8a91b3]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {formatDeadline(task.expected_deadline)} 截止
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        {task.submitter_name}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[#f0a92b]">
                        <Trophy className="h-4 w-4" />
                        <span className="text-sm font-semibold">{task.reward} 澳维豆</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-[#9ca4c4]">
                        <Users className="h-4 w-4" />
                        <span>{task.claimCount || 0} 人申领</span>
                      </div>
                    </div>

                    {task.reward_item && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-[#56baa8]">
                        <Gift className="h-4 w-4" />
                        <span>{task.reward_item}</span>
                      </div>
                    )}

                    {task.ratings && (
                      <div className="mt-4 space-y-2 rounded-2xl bg-[#fafbff] px-4 py-3">
                        {[
                          { label: '应用思维', value: ratings.application },
                          { label: '产品思维', value: ratings.product },
                          { label: '工程思维', value: ratings.engineering },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="text-xs text-[#8f96b7]">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">{renderStars(item.value)}</div>
                              <span className="text-xs text-[#9ca4c4]">{item.value} 星</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5">
                      {task.status === 'published' || task.status === 'claimed' ? (
                        claimed ? (
                          <button
                            disabled
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#edf0fa] text-sm font-medium text-[#8d96b9]"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>已申领</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleClaim(task.id);
                            }}
                            disabled={claiming === task.id}
                            className="btn-primary h-11 w-full gap-2 rounded-[10px] text-sm"
                          >
                            {claiming === task.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : null}
                            <span>{claiming === task.id ? '提交中...' : '申领任务'}</span>
                          </button>
                        )
                      ) : (
                        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#7d4fff] to-[#625dff] text-sm font-medium text-white">
                          <span>查看详情</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              </div>
              <PaginationControls
                page={tasksPagination.page}
                pageSize={tasksPagination.pageSize}
                totalItems={tasksPagination.totalItems}
                totalPages={tasksPagination.totalPages}
                onPageChange={tasksPagination.setPage}
                onPageSizeChange={tasksPagination.setPageSize}
              />
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="page-panel p-5">
            <div className="text-[24px] font-semibold text-[#252a48]">快捷入口</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {quickLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="rounded-2xl bg-[#fafbff] px-3 py-4 text-center transition hover:bg-[#f1f3ff]"
                >
                  <item.icon className="mx-auto h-5 w-5 text-[#7353ff]" />
                  <div className="mt-2 text-sm font-medium text-[#4f5578]">{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="page-panel p-5">
            <div className="text-[24px] font-semibold text-[#252a48]">热门标签</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['图像识别', '自然语言处理', '数据分析', '深度学习', 'NLP', '计算机视觉'].map((tag) => (
                <span key={tag} className="rounded-xl bg-[#f5f7ff] px-3 py-2 text-sm text-[#6d7398]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

