import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Gift, PlusCircle, Trophy } from 'lucide-react';
import { createTask } from '../api/api';
import { useAuthStore } from '../store/authStore';

const categoryOptions = [
  { value: 'model_training', label: 'AI训练' },
  { value: 'data_analysis', label: '数据处理' },
  { value: 'other', label: '内容生成' },
  { value: 'design', label: '设计创意' },
  { value: 'dev', label: '开发任务' },
  { value: 'misc', label: '其他' },
];

export default function SubmitTask() {
  const [formData, setFormData] = useState({
    title: '',
    type: 'model_training',
    description: '',
    rewardPoints: '',
    rewardItem: '',
    expected_deadline: '',
  });
  const [selectedRewards, setSelectedRewards] = useState({
    points: true,
    item: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleAuthExpired = () => {
    logout();
    window.alert('登录状态已失效，请重新登录。');
    navigate('/login');
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRewardToggle = (type: 'points' | 'item') => {
    setSelectedRewards((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      if (!next.points && !next.item) {
        return { points: true, item: false };
      }
      return next;
    });
  };

  const getDefaultDeadline = () => {
    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - timezoneOffset).toISOString().split('T')[0];
  };

  const resetForm = () => {
    setSuccess(false);
    setError('');
    setFormData({
      title: '',
      type: 'model_training',
      description: '',
      rewardPoints: '',
      rewardItem: '',
      expected_deadline: '',
    });
    setSelectedRewards({ points: true, item: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const effectiveDeadline = formData.expected_deadline || getDefaultDeadline();

    if (!formData.title.trim() || !formData.type || !effectiveDeadline) {
      setError('请填写所有必填项。');
      setLoading(false);
      return;
    }

    if (!selectedRewards.points && !selectedRewards.item) {
      setError('请至少选择一种奖励类型。');
      setLoading(false);
      return;
    }

    if (selectedRewards.points && (!formData.rewardPoints || Number(formData.rewardPoints) < 1)) {
      setError('澳维豆奖励至少需要 1 豆。');
      setLoading(false);
      return;
    }

    if (selectedRewards.item && !formData.rewardItem.trim()) {
      setError('请填写实物奖励说明。');
      setLoading(false);
      return;
    }

    try {
      const result = await createTask({
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        reward: selectedRewards.points ? Number(formData.rewardPoints) : 0,
        reward_type: selectedRewards.points && selectedRewards.item ? 'both' : selectedRewards.points ? 'points' : 'item',
        reward_item: selectedRewards.item ? formData.rewardItem.trim() : undefined,
        difficulty: 'medium',
        expected_deadline: effectiveDeadline,
      });

      if (result.id) {
        setSuccess(true);
      } else if (
        typeof result.error === 'string' &&
        (result.error.includes('token') || result.error.includes('未授权') || result.error.includes('用户不存在'))
      ) {
        handleAuthExpired();
      } else {
        setError(result.error || '发布失败');
      }
    } catch {
      setError('网络错误，请重试。');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card py-12 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">任务发布成功</h2>
          <p className="mb-6 text-gray-500">您的任务已提交，等待技术专家审核。</p>
          <div className="flex justify-center space-x-4">
            <button onClick={() => navigate('/')} className="btn-primary">
              返回任务列表
            </button>
            <button onClick={resetForm} className="btn-secondary">
              继续发布
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center space-x-4">
        <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
          <span>返回</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">发布任务</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="请输入任务标题"
              className="form-input"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              任务类别 <span className="text-red-500">*</span>
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="form-input"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">任务描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="请详细描述任务内容、需求和交付标准"
              rows={4}
              className="form-textarea"
            />
          </div>

          <div className="mb-4">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              奖励类型 <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">（可多选）</span>
            </label>
            <div className="flex space-x-4">
              <label
                className={`flex flex-1 cursor-pointer items-center justify-center space-x-2 rounded-lg border-2 p-4 transition-colors ${
                  selectedRewards.points
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRewards.points}
                  onChange={() => handleRewardToggle('points')}
                  className="hidden"
                />
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                    selectedRewards.points ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                  }`}
                >
                  {selectedRewards.points ? <CheckCircle className="h-3 w-3 text-white" /> : null}
                </div>
                <Trophy
                  className={`h-5 w-5 ${
                    selectedRewards.points ? 'text-primary-600' : 'text-gray-400'
                  }`}
                />
                <span className={`font-medium ${selectedRewards.points ? 'text-primary-700' : 'text-gray-700'}`}>
                  澳维豆奖励
                </span>
              </label>

              <label
                className={`flex flex-1 cursor-pointer items-center justify-center space-x-2 rounded-lg border-2 p-4 transition-colors ${
                  selectedRewards.item
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRewards.item}
                  onChange={() => handleRewardToggle('item')}
                  className="hidden"
                />
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                    selectedRewards.item ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                  }`}
                >
                  {selectedRewards.item ? <CheckCircle className="h-3 w-3 text-white" /> : null}
                </div>
                <Gift
                  className={`h-5 w-5 ${selectedRewards.item ? 'text-primary-600' : 'text-gray-400'}`}
                />
                <span className={`font-medium ${selectedRewards.item ? 'text-primary-700' : 'text-gray-700'}`}>
                  实物奖励
                </span>
              </label>
            </div>
          </div>

          {selectedRewards.points ? (
            <div className="mb-4">
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700">
                <Trophy className="mr-1 h-4 w-4 text-yellow-500" />
                澳维豆数量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="rewardPoints"
                value={formData.rewardPoints}
                onChange={handleChange}
                min="1"
                placeholder="请输入澳维豆数量"
                className="form-input"
              />
            </div>
          ) : null}

          {selectedRewards.item ? (
            <div className="mb-4">
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700">
                <Gift className="mr-1 h-4 w-4 text-yellow-500" />
                实物奖励说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="rewardItem"
                value={formData.rewardItem}
                onChange={handleChange}
                placeholder="请描述实物奖励内容"
                rows={3}
                className="form-textarea"
              />
            </div>
          ) : null}

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              期望完成时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="expected_deadline"
              value={formData.expected_deadline || getDefaultDeadline()}
              onChange={handleChange}
              min={getDefaultDeadline()}
              className="form-input"
            />
          </div>

          {error ? (
            <div className="mb-4 flex items-center text-red-500">
              <AlertCircle className="mr-2 h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>发布中...</span>
              </>
            ) : (
              <>
                <PlusCircle className="h-5 w-5" />
                <span>发布任务</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
