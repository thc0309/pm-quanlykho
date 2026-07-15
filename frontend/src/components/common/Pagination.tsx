const PAGE_SIZE = 10;

const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";

function getTotalPages(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
}

export function paginate<T>(items: T[], page: number) {
  const safePage = Math.min(page, getTotalPages(items.length));
  return items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
}

export function Pagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const totalPages = getTotalPages(totalItems);
  const safePage = Math.min(page, totalPages);

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:text-gray-400">
      <span>
        Trang {safePage} / {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          className={secondaryButtonClass}
        >
          Trước
        </button>
        <button
          type="button"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className={secondaryButtonClass}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
