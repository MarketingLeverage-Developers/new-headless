// hooks/useGridMeta.ts
import { useMemo } from 'react';

export type UseGridMetaParams = {
    columnOrder: string[];
    visibleKeys: string[];
    widthByKey: Record<string, number>;
    defaultColWidth: number;
    pinnedColumnKeys: string[];
    dragPreviewOrder: string[] | null;
    containerWidthPx: number;

    /** ✅ 추가 */
    fillContainerWidth?: boolean;
};

export type UseGridMetaResult = {
    baseOrder: string[];
    previewOrder: string[];
    layoutWidthByKey: Record<string, number>;
    gridTemplateColumns: string;
    baseXByKey: Record<string, number>;
    offsetByKey: Record<string, number>;
    tableMinWidthPx: number;
};

const pickFillTargetKey = (params: { baseOrder: string[]; pinnedColumnKeys: string[] }) => {
    const { baseOrder, pinnedColumnKeys } = params;
    const normalKeys = baseOrder.filter((k) => !pinnedColumnKeys.includes(k));
    if (normalKeys.length > 0) return normalKeys[normalKeys.length - 1];
    return baseOrder.length > 0 ? baseOrder[baseOrder.length - 1] : null;
};

const calcSumWidth = (params: { keys: string[]; widthByKey: Record<string, number>; defaultColWidth: number }) => {
    const { keys, widthByKey, defaultColWidth } = params;
    return keys.reduce((acc, k) => acc + (widthByKey[k] ?? defaultColWidth), 0);
};

export const useGridMeta = ({
    columnOrder,
    visibleKeys,
    widthByKey,
    defaultColWidth,
    pinnedColumnKeys,
    dragPreviewOrder,
    containerWidthPx,
    fillContainerWidth = true,
}: UseGridMetaParams): UseGridMetaResult => {
    const baseOrder = useMemo(() => {
        const base = columnOrder.filter((k) => visibleKeys.includes(k));
        visibleKeys.forEach((k) => {
            if (!base.includes(k)) base.push(k);
        });

        const pinned = pinnedColumnKeys.filter((k) => base.includes(k));
        const normal = base.filter((k) => !pinned.includes(k));
        return [...pinned, ...normal];
    }, [columnOrder, visibleKeys, pinnedColumnKeys]);

    const previewOrder = useMemo(() => {
        const p = dragPreviewOrder?.filter((k) => baseOrder.includes(k)) ?? null;
        if (!p || p.length === 0) return baseOrder;
        return p;
    }, [dragPreviewOrder, baseOrder]);

    const layoutWidthByKey = useMemo(() => {
        if (!fillContainerWidth) return widthByKey; // ✅ 끄면 원본 그대로

        const sum = calcSumWidth({ keys: baseOrder, widthByKey, defaultColWidth });
        const diff = Math.floor(containerWidthPx - sum);

        if (diff <= 0) return widthByKey;
        const targetKey = pickFillTargetKey({ baseOrder, pinnedColumnKeys });
        if (!targetKey) return widthByKey;

        const next: Record<string, number> = { ...widthByKey };
        next[targetKey] = (next[targetKey] ?? defaultColWidth) + diff;
        return next;
    }, [fillContainerWidth, baseOrder, widthByKey, defaultColWidth, containerWidthPx, pinnedColumnKeys]);

    const gridTemplateColumns = useMemo(
        () => baseOrder.map((k) => `${layoutWidthByKey[k] ?? defaultColWidth}px`).join(' '),
        [baseOrder, layoutWidthByKey, defaultColWidth]
    );

    const baseXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        baseOrder.forEach((k) => {
            map[k] = acc;
            acc += layoutWidthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [baseOrder, layoutWidthByKey, defaultColWidth]);

    const previewXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        previewOrder.forEach((k) => {
            map[k] = acc;
            acc += layoutWidthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [previewOrder, layoutWidthByKey, defaultColWidth]);

    const offsetByKey = useMemo(() => {
        const map: Record<string, number> = {};
        baseOrder.forEach((k) => {
            map[k] = (previewXByKey[k] ?? 0) - (baseXByKey[k] ?? 0);
        });
        return map;
    }, [baseOrder, previewXByKey, baseXByKey]);

    const tableMinWidthPx = useMemo(
        () => calcSumWidth({ keys: baseOrder, widthByKey: layoutWidthByKey, defaultColWidth }),
        [baseOrder, layoutWidthByKey, defaultColWidth]
    );

    return { baseOrder, previewOrder, layoutWidthByKey, gridTemplateColumns, baseXByKey, offsetByKey, tableMinWidthPx };
};
