import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function usePagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, resetDeps);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageSize,
    totalPages,
    totalItems: items.length,
    pagedItems,
    setPage,
    setPageSize,
  };
}
