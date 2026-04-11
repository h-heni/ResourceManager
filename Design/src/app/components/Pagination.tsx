import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
    page: number;
    totalPages: number;
    totalCount: number;
    size: number;
    onPageChange: (page: number) => void;
    onSizeChange?: (size: number) => void;
    sizes?: number[];
}

export default function Pagination({
    page,
    totalPages,
    totalCount,
    size,
    onPageChange,
    onSizeChange,
    sizes = [10, 20, 50]
}: PaginationProps) {
    const { t } = useTranslation();
    if (totalCount === 0) return null;

    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, totalCount);

    // Build visible page numbers (max 5 around current)
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (page > 3) pages.push('...');
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
            pages.push(i);
        }
        if (page < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    return (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-b-xl">
            {/* Mobile */}
            <div className="flex flex-1 justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('pagination.previous', 'Previous')}
                </button>
                <span className="flex items-center text-sm text-gray-700">
                    {page} / {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('pagination.next', 'Next')}
                </button>
            </div>

            {/* Desktop */}
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-700">
                        {t('pagination.showing', 'Showing')}{' '}
                        <span className="font-medium">{start}</span>{' '}
                        {t('pagination.to', 'to')}{' '}
                        <span className="font-medium">{end}</span>{' '}
                        {t('pagination.of', 'of')}{' '}
                        <span className="font-medium">{totalCount}</span>{' '}
                        {t('pagination.results', 'results')}
                    </p>
                    {onSizeChange && (
                        <select
                            value={size}
                            onChange={(e) => onSizeChange(Number(e.target.value))}
                            className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-8 text-sm text-gray-700 focus:border-[#065F46] focus:outline-none focus:ring-1 focus:ring-[#065F46]"
                        >
                            {sizes.map(s => (
                                <option key={s} value={s}>{s} / {t('pagination.page', 'page')}</option>
                            ))}
                        </select>
                    )}
                </div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    {pages.map((p, i) =>
                        p === '...' ? (
                            <span key={`dot-${i}`} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 ${
                                    p === page
                                        ? 'z-10 bg-[#065F46] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46]'
                                        : 'text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </nav>
            </div>
        </div>
    );
}
