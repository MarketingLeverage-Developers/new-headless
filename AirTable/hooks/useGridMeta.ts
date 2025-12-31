// hooks/useGridMeta.ts
import { useMemo } from 'react';

export type UseGridMetaParams = {
    columnOrder: string[];
    visibleKeys: string[];
    widthByKey: Record<string, number>;
    defaultColWidth: number;
    pinnedColumnKeys: string[];
    dragPreviewOrder: string[] | null;
};

export type UseGridMetaResult = {
    baseOrder: string[];
    previewOrder: string[];
    gridTemplateColumns: string;
    baseXByKey: Record<string, number>;
    offsetByKey: Record<string, number>;
    tableMinWidthPx: number;
};

export const useGridMeta = ({
    columnOrder,
    visibleKeys,
    widthByKey,
    defaultColWidth,
    pinnedColumnKeys,
    dragPreviewOrder,
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

    const gridTemplateColumns = useMemo(
        () => baseOrder.map((k) => `${widthByKey[k] ?? defaultColWidth}px`).join(' '),
        [baseOrder, widthByKey, defaultColWidth]
    );

    const baseXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        baseOrder.forEach((k) => {
            map[k] = acc;
            acc += widthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [baseOrder, widthByKey, defaultColWidth]);

    const previewXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        previewOrder.forEach((k) => {
            map[k] = acc;
            acc += widthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [previewOrder, widthByKey, defaultColWidth]);

    const offsetByKey = useMemo(() => {
        const map: Record<string, number> = {};
        baseOrder.forEach((k) => {
            map[k] = (previewXByKey[k] ?? 0) - (baseXByKey[k] ?? 0);
        });
        return map;
    }, [baseOrder, previewXByKey, baseXByKey]);

    const tableMinWidthPx = useMemo(
        () => baseOrder.reduce((acc, k) => acc + (widthByKey[k] ?? defaultColWidth), 0),
        [baseOrder, widthByKey, defaultColWidth]
    );

    return {
        baseOrder,
        previewOrder,
        gridTemplateColumns,
        baseXByKey,
        offsetByKey,
        tableMinWidthPx,
    };
};
