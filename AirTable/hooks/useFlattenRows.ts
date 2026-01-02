import { useMemo } from 'react';
import type { CellRenderMeta, ColumnType } from '../AirTable';

export type FlattenRow<T> = {
    key: string;
    item: T;
    level: number;
    cells: {
        key: string;
        render: (item: T, rowIndex: number, meta: CellRenderMeta<T>) => React.ReactElement;
    }[];
};

export const useFlattenRows = <T>({
    data,
    orderedLeafColumns,
    visibleColumnKeys,
    rowKeyField,
    getRowLevel,
    getExpandedRows,
    expandedRowKeys,
}: {
    data: T[];
    orderedLeafColumns: ColumnType<T>[];
    visibleColumnKeys: string[];
    rowKeyField?: string;
    getRowLevel?: (row: T, ri: number) => number;
    getExpandedRows?: (row: T, ri: number) => T[];
    expandedRowKeys: Set<string>;
}) => {
    const rows = useMemo<FlattenRow<T>[]>(() => {
        const result: FlattenRow<T>[] = [];

        data.forEach((item, ri) => {
            const rawKey = rowKeyField ? (item as any)[rowKeyField] : undefined;
            const rowKey = typeof rawKey === 'string' || typeof rawKey === 'number' ? String(rawKey) : `row-${ri}`;

            const level = getRowLevel ? getRowLevel(item, ri) : 0;

            const cells = orderedLeafColumns
                .filter((leaf) => visibleColumnKeys.includes(leaf.key))
                .map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number, meta: CellRenderMeta<T>) => leaf.render(it, idx, meta),
                }));

            const baseRow: FlattenRow<T> = {
                key: rowKey,
                item,
                level,
                cells,
            };

            result.push(baseRow);

            const expanded = expandedRowKeys.has(rowKey);
            if (!expanded) return;
            if (!getExpandedRows) return;

            const children = getExpandedRows(item, ri) ?? [];
            children.forEach((child, ci) => {
                const childKey = `${rowKey}__child-${ci}`;

                result.push({
                    key: childKey,
                    item: child,
                    level: level + 1,
                    cells,
                });
            });
        });

        return result;
    }, [data, orderedLeafColumns, visibleColumnKeys, rowKeyField, getRowLevel, getExpandedRows, expandedRowKeys]);

    return { rows };
};
