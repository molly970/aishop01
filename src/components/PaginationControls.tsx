import { PAGE_SIZE_OPTIONS } from '../hooks/usePagination';

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
};

const buildVisiblePages = (page: number, totalPages: number) => {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  return Array.from(pages).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
};

export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  className = '',
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className={`flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>
          显示第 <span className="font-medium text-gray-700">{start}</span> -{' '}
          <span className="font-medium text-gray-700">{end}</span> 条，共{' '}
          <span className="font-medium text-gray-700">{totalItems}</span> 条
        </span>
        <div className="flex items-center gap-2">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} 条
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>

        {visiblePages.map((item, index) => (
          <div key={item} className="flex items-center gap-2">
            {index > 0 && item - visiblePages[index - 1] > 1 ? (
              <span className="px-1 text-sm text-gray-400">...</span>
            ) : null}
            <button
              onClick={() => onPageChange(item)}
              className={`min-w-[38px] rounded-lg px-3 py-1.5 text-sm transition ${
                item === page
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item}
            </button>
          </div>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
