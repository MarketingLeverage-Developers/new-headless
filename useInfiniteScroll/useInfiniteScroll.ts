import { useEffect, useRef } from 'react';

type UseInfiniteScrollParams = {
    total: number;
    page: number;
    size: number;
    onChange: (page: number) => void;
    isLoading?: boolean;
    disabled?: boolean;
    rootMargin?: string;
    threshold?: number;
    minIntervalMs?: number;
};

export const useInfiniteScroll = ({
    total,
    page,
    size,
    onChange,
    isLoading = false,
    disabled = false,
    rootMargin = '100px',
    threshold = 0.1,
    minIntervalMs = 500,
}: UseInfiniteScrollParams) => {
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const lastCallTime = useRef<number>(0);
    const hasMore = page * size < total;

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

    return { triggerRef, hasMore };
};
