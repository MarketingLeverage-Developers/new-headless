import { useEffect } from 'react';

export const useAutoScroll = ({
    scrollRef,
    lastMouseClientRef,
    enabled,
}: {
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;
    lastMouseClientRef: React.MutableRefObject<{ x: number; y: number } | null>;
    enabled: boolean;
}) => {
    useEffect(() => {
        if (!enabled) return;

        let rafId = 0;

        const tick = () => {
            const scrollEl = scrollRef.current;
            const last = lastMouseClientRef.current;

            if (!scrollEl || !last) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const rect = scrollEl.getBoundingClientRect();
            const edge = 80;
            const maxSpeed = 48;

            const distLeft = last.x - rect.left;
            const distRight = rect.right - last.x;

            let dx = 0;

            if (distLeft >= 0 && distLeft < edge) {
                const ratio = 1 - distLeft / edge;
                const accel = ratio * ratio;
                dx = -Math.max(2, Math.round(maxSpeed * accel));
            } else if (distRight >= 0 && distRight < edge) {
                const ratio = 1 - distRight / edge;
                const accel = ratio * ratio;
                dx = Math.max(2, Math.round(maxSpeed * accel));
            }

            if (dx !== 0) scrollEl.scrollLeft += dx;

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [enabled, scrollRef, lastMouseClientRef]);
};
