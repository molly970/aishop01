import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { createSubmission, getTaskById, Submission, Task } from '../api/api';
import { AlertCircle, ArrowLeft, CheckCircle, FileText, Image, Upload, X } from 'lucide-react';

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
};

export default function SubmitResult() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [description, setDescription] = useState('');
  const [aiTool, setAiTool] = useState('');
  const [prompt, setPrompt] = useState('');
  const [usageGuide, setUsageGuide] = useState('');
  const [commitment, setCommitment] = useState(false);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as { backTo?: string; backLabel?: string } | null;
  const backTo = navigationState?.backTo || `/task/${taskId}`;
  const backLabel = navigationState?.backLabel || '返回任务详情';

  useEffect(() => {
    if (!taskId) return;
    void fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const data = await getTaskById(taskId!);
      setTask(data);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  const mySubmissions = useMemo(() => {
    const allSubmissions = Array.isArray(task?.submissions) ? task.submissions : [];
    return allSubmissions
      .filter((submission) => submission.submitter_id === user?.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [task?.submissions, user?.id]);

  const latestSubmission = mySubmissions[0];
  const isAssigned = task?.assignee_id === user?.id;
  const isCompleted = task?.status === 'completed';
  const hasPendingSubmission = latestSubmission?.status === 'pending';
  const resubmitAvailable = latestSubmission?.status === 'rejected' && mySubmissions.length < 2;
  const reachedRejectLimit = latestSubmission?.status === 'rejected' && mySubmissions.length >= 2;
  const canSubmit =
    isAssigned &&
    !isCompleted &&
    !hasPendingSubmission &&
    (mySubmissions.length === 0 || resubmitAvailable);

  const readOnlyReason = !isAssigned
    ? '只有被分配的用户才能提交结果'
    : isCompleted
      ? '该任务已完成，不可再次填写，仅可查看记录'
      : hasPendingSubmission
        ? '当前已有待验收结果，请等待审核，仅可查看记录'
        : reachedRejectLimit
          ? '提交结果已被拒绝两次，不可再次填写，仅可查看记录'
          : '';

  const handleResultFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setResultFile(event.target.files[0]);
    }
  };

  const handleScreenshotsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setScreenshots((current) => [...current, ...newFiles]);
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      setScreenshotPreviews((current) => [...current, ...newPreviews]);
    }
  };

  const removeScreenshot = (index: number) => {
    URL.revokeObjectURL(screenshotPreviews[index]);
    setScreenshots((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setScreenshotPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskId || !task?.task_no) return;

    setSubmitting(true);
    setError('');

    if (!commitment) {
      setError('需要勾选承诺声明');
      setSubmitting(false);
      return;
    }

    try {
      const result = await createSubmission({
        task_id: taskId,
        task_no: task.task_no,
        description,
        ai_tool: aiTool,
        prompt,
        usage_guide: usageGuide,
        commitment: true,
        resultFile: resultFile || undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      });

      if (result.id) {
        setSuccess(true);
        await fetchTask();
      } else {
        setError(result.error || '提交失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p className="text-gray-500">任务不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(`/task/${taskId}`)} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
          <span>返回任务详情</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">提交任务结果</h1>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800">任务信息</h3>
        <p className="mt-2 text-gray-700">{task.title}</p>
        {task.task_no ? <p className="mt-1 text-sm text-gray-500">任务编号：{task.task_no}</p> : null}
      </div>

      {success ? (
        <div className="card text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="text-xl font-bold text-gray-800">提交成功</h2>
          <p className="mt-2 text-gray-500">您的任务结果已提交，等待验收确认。</p>
          <button onClick={() => navigate(`/task/${taskId}`)} className="btn-primary mt-6 px-6">
            返回任务详情
          </button>
        </div>
      ) : null}

      {!success && readOnlyReason ? (
        <div className="card border border-amber-100 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <div className="font-medium text-amber-700">当前不可再次填写</div>
              <div className="mt-1 text-sm text-amber-700">{readOnlyReason}</div>
            </div>
          </div>
        </div>
      ) : null}

      {!success && canSubmit ? (
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">使用说明</label>
              <textarea
                value={usageGuide}
                onChange={(event) => setUsageGuide(event.target.value)}
                placeholder="请描述成果的使用方法..."
                rows={4}
                className="form-input resize-none"
              />
            </div>

            <div>
              <label className="form-label">使用的 AI 工具</label>
              <input
                type="text"
                value={aiTool}
                onChange={(event) => setAiTool(event.target.value)}
                placeholder="例如：ChatGPT、Midjourney、DALL-E"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">核心提示词</label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="请输入您使用的主要提示词..."
                rows={4}
                className="form-input resize-none"
              />
            </div>

            <div>
              <label className="form-label">
                成果文件
                <span className="ml-2 text-sm font-normal text-gray-400">(支持 PDF、DOC、DOCX、XLS、XLSX、PPT、PPTX 等)</span>
              </label>
              <div
                onClick={() => document.getElementById('result-file-input')?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-500"
              >
                <Upload className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                {resultFile ? (
                  <div>
                    <p className="font-medium text-gray-700">{resultFile.name}</p>
                    <p className="text-sm text-gray-500">{(resultFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <p className="text-gray-500">点击上传成果文件</p>
                )}
              </div>
              <input
                id="result-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleResultFileChange}
                className="hidden"
              />
            </div>

            <div>
              <label className="form-label">
                相关截图
                <span className="ml-2 text-sm font-normal text-gray-400">(支持 JPG、PNG、GIF 等)</span>
              </label>
              <div
                onClick={() => document.getElementById('screenshot-input')?.click()}
                className="mb-4 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-500"
              >
                <Image className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                <p className="text-gray-500">点击上传截图</p>
              </div>
              <input
                id="screenshot-input"
                type="file"
                multiple
                accept="image/*"
                onChange={handleScreenshotsChange}
                className="hidden"
              />

              {screenshotPreviews.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {screenshotPreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`截图 ${index + 1}`} className="h-24 w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={commitment}
                  onChange={(event) => setCommitment(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  本人已按任务要求完成交付，成果真实可复用、无抄袭、无重大错误。
                </span>
              </label>
            </div>

            {error ? (
              <div className="flex items-center text-red-500">
                <AlertCircle className="mr-2 h-5 w-5" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>提交中...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>{resubmitAvailable ? '重新提交结果' : '提交结果'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800">结果提交记录</h3>
        {mySubmissions.length === 0 ? (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-10 text-center text-gray-500">暂无结果提交记录</div>
        ) : (
          <div className="mt-4 space-y-4">
            {mySubmissions.map((submission: Submission, index) => (
              <div key={submission.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800">第 {mySubmissions.length - index} 次提交</div>
                    <div className="mt-1 text-xs text-gray-500">{formatDateTime(submission.created_at)}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      submission.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : submission.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {submission.status === 'approved' ? '已通过' : submission.status === 'rejected' ? '已驳回' : '待验收'}
                  </span>
                </div>

                {submission.description ? (
                  <div className="mb-2 text-sm text-gray-600">{submission.description}</div>
                ) : null}
                {submission.ai_tool ? (
                  <div className="mb-1 text-sm text-gray-600">
                    <span className="font-medium">使用工具：</span>
                    {submission.ai_tool}
                  </div>
                ) : null}
                {submission.prompt ? (
                  <div className="mb-1 text-sm text-gray-600">
                    <span className="font-medium">核心提示词：</span>
                    {submission.prompt}
                  </div>
                ) : null}
                {submission.usage_guide ? (
                  <div className="mb-1 text-sm text-gray-600">
                    <span className="font-medium">使用说明：</span>
                    {submission.usage_guide}
                  </div>
                ) : null}
                {submission.review_comment ? (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <span className="font-medium">审核意见：</span>
                    {submission.review_comment}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
