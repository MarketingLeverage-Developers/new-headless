import { useEffect, useRef } from 'react';

type UseInfiniteScrollParams = {
    total: number;
    totalPages?: number;
    page: number;
    size: number;
    onChange: (page: number) => void;
    isLoading?: boolean;
    disabled?: boolean;
    hasMore?: boolean;
    lastPageCount?: number;
    rootMargin?: string;
    threshold?: number;
    minIntervalMs?: number;
};

export const useInfiniteScroll = ({
    total,
    totalPages,
    page,
    size,
    onChange,
    isLoading = false,
    disabled = false,
    hasMore: hasMoreOverride,
    lastPageCount,
    rootMargin = '100px',
    threshold = 0.1,
    minIntervalMs = 500,
}: UseInfiniteScrollParams) => {
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const lastCallTime = useRef<number>(0);
    const resolveHasMore = () => {
        if (typeof hasMoreOverride === 'boolean') return { hasMore: hasMoreOverride, showEndMessage: !hasMoreOverride };
        if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > 0) {
            const hasMore = page < totalPages;
            return { hasMore, showEndMessage: !hasMore };
        }
        if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
            const hasMore = page * size < total;
            return { hasMore, showEndMessage: !hasMore };
        }
        if (typeof lastPageCount === 'number' && Number.isFinite(lastPageCount)) {
            if (lastPageCount < size && page > 1) {
                return { hasMore: false, showEndMessage: true };
            }
            return { hasMore: true, showEndMessage: false };
        }
        return { hasMore: true, showEndMessage: false };
    };

    const { hasMore, showEndMessage } = resolveHasMore();

    useEffect(() => {
        if (!hasMore || isLoading || disabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const now = Date.now();
                if (entries[0]?.isIntersecting && now - lastCallTime.current > minIntervalMs) {
                    lastCallTime.current = now;
                    onChange(page + 1);
                }
            },
            { threshold, rootMargin }
        );

        if (triggerRef.current) {
            observer.observe(triggerRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoading, disabled, page, onChange, threshold, rootMargin, minIntervalMs]);

    return { triggerRef, hasMore, showEndMessage };
};
