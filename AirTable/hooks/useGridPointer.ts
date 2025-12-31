// hooks/useGridPointer.ts
import { useCallback } from 'react';

export type UseGridPointerParams = {
    wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;

    baseOrder: string[];
    baseXByKey: Record<string, number>;
    widthByKey: Record<string, number>;
    defaultColWidth: number;
};

export type UseGridPointerResult = {
    getXInGrid: (clientX: number) => number;
    getYInGrid: (clientY: number) => number;
    isInsideScrollAreaX: (clientX: number) => boolean;
    calcInsertIndex: (x: number, draggingKey: string) => number;
};

export const useGridPointer = ({
    wrapperRef,
    scrollRef,
    baseOrder,
    baseXByKey,
    widthByKey,
    defaultColWidth,
}: UseGridPointerParams): UseGridPointerResult => {
    const getXInGrid = useCallback(
        (clientX: number) => {
            const el = scrollRef.current;
            if (!el) return clientX;
            const rect = el.getBoundingClientRect();
            return clientX - rect.left + el.scrollLeft;
        },
        [scrollRef]
    );

    const getYInGrid = useCallback(
        (clientY: number) => {
            const wrap = wrapperRef.current;
            if (!wrap) return clientY;
            const rect = wrap.getBoundingClientRect();
            const scrollTop = scrollRef.current?.scrollTop ?? 0;
            return clientY - rect.top + scrollTop;
        },
        [wrapperRef, scrollRef]
    );

    const isInsideScrollAreaX = useCallback(
        (clientX: number) => {
            const el = scrollRef.current;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return clientX >= rect.left && clientX <= rect.right;
        },
        [scrollRef]
    );

    const calcInsertIndex = useCallback(
        (x: number, draggingKey: string) => {
            const filtered = baseOrder.filter((k) => k !== draggingKey);

            for (let i = 0; i < filtered.length; i += 1) {
                const key = filtered[i];
                const left = baseXByKey[key] ?? 0;
                const w = widthByKey[key] ?? defaultColWidth;
                const mid = left + w / 2;
                if (x < mid) return i;
            }

            return filtered.length;
        },
        [baseOrder, baseXByKey, widthByKey, defaultColWidth]
    );

    return {
        getXInGrid,
        getYInGrid,
        isInsideScrollAreaX,
        calcInsertIndex,
    };
};
