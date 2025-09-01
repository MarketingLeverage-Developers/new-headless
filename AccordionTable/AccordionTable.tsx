import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    Body,
    BodyRows,
    Cell,
    ColGroup,
    Details,
    GroupHeader,
    Header,
    HeaderRows,
    Row,
    Th,
    Toggle,
} from './components';

export {
    RowDetailsProvider,
    useDetailsRenderer,
    useRowDetails,
    type DetailsRenderer,
} from './components/Details/Details';

export interface ColumnType<T> {
    key: string;
    render: (item: T, index: number) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
}

export type Column<T> = {
    key: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render?: (item: T, index: number) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
};

export type UseTableParams<T> = {
    columns: Column<T>[];
    data: T[];
    defaultColWidth?: number;
    containerPaddingPx?: number;
};

export type UseTableResult<T> = {
    groupColumnRow: {
        key: string;
        columns: {
            key: string;
            colSpan: number;
            render: (key: string, data?: T[]) => React.ReactElement;
        }[];
    };
    columnRow: {
        key: string;
        columns: {
            key: string;
            render: (key: string, data?: T[]) => React.ReactElement;
            width: number;
        }[];
    };
    rows: {
        key: string;
        item: T;
        cells: {
            key: string;
            render: (item: T, rowIndex: number) => React.ReactElement;
        }[];
        hiddenCells: {
            key: string;
            label: React.ReactNode;
            render: (item: T, rowIndex: number) => React.ReactElement;
        }[];
    }[];
    getColStyle: (colIndex: number) => React.CSSProperties;
    hiddenKeys: string[];
    hasHidden: boolean;
};

const toNumberPx = (w: number | string | undefined, fallback: number, containerW: number) => {
    if (typeof w === 'number') return w;
    if (typeof w === 'string') {
        const s = w.trim();
        if (s.endsWith('%')) {
            const p = parseFloat(s.slice(0, -1));
            if (!Number.isNaN(p)) return Math.max(0, (containerW * p) / 100);
        }
        const px = parseFloat(s);
        if (!Number.isNaN(px)) return px;
    }
    return fallback;
};

const measureParentWidth = (el: HTMLTableElement | null) => {
    if (!el || !el.parentElement) return 0;
    const rect = el.parentElement.getBoundingClientRect();
    return rect.width;
};

export const useTable = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    containerWidth,
}: UseTableParams<T> & { containerWidth: number }): UseTableResult<T> => {
    const leafColumns = useMemo(
        () =>
            columns.flatMap((col) => {
                if (col.children && col.children.length > 0) return col.children;
                const render =
                    col.render ??
                    (((_it: T, _idx: number) => null) as unknown as (item: T, index: number) => React.ReactElement);
                return [{ key: col.key, render, header: col.header, width: col.width } as ColumnType<T>];
            }),
        [columns]
    );

    const innerWidth = Math.max(0, containerWidth - containerPaddingPx);

    const leafWidthsPx = useMemo(
        () => leafColumns.map((c) => toNumberPx(c.width, defaultColWidth, innerWidth)),
        [leafColumns, defaultColWidth, innerWidth]
    );

    const visibleLeaf = leafColumns;
    const hiddenLeaf: ColumnType<T>[] = [];
    const hiddenKeys: string[] = [];
    const hasHidden = false;

    const columnRow = useMemo(
        () => ({
            key: 'column',
            columns: visibleLeaf.map((c, idx) => ({
                key: c.key,
                render: () => c.header(c.key, data),
                width: Math.round(leafWidthsPx[idx] ?? defaultColWidth),
            })),
        }),
        [visibleLeaf, leafWidthsPx, data, defaultColWidth]
    );

    const groupColumnRow = useMemo(() => {
        const visibleKeys = new Set(visibleLeaf.map((c) => c.key));
        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                const span = col.children.filter((ch) => visibleKeys.has(ch.key)).length;
                return span;
            }
            return visibleKeys.has(col.key) ? 1 : 0;
        };
        return {
            key: 'group-column',
            columns: columns
                .map((col) => ({
                    key: col.key,
                    colSpan: calcSpan(col),
                    render: (key: string) => col.header(key, data),
                }))
                .filter((c) => c.colSpan > 0),
        };
    }, [columns, data, visibleLeaf]);

    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => ({
                key: `row-${rowIndex}`,
                item,
                cells: visibleLeaf.map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number) => leaf.render(it, idx),
                })),
                hiddenCells: hiddenLeaf.map((leaf) => ({
                    key: leaf.key,
                    label: leaf.header(leaf.key, data),
                    render: (it: T, idx: number) => leaf.render(it, idx),
                })),
            })),
        [data, visibleLeaf, hiddenLeaf]
    );

    const getColStyle = (colIndex: number) => {
        const w = columnRow.columns[colIndex]?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

    return { groupColumnRow, columnRow, rows, getColStyle, hiddenKeys, hasHidden };
};

export type TableContextValue<T> = { state: UseTableResult<T>; data: T[] };
type InternalTableContextValue = TableContextValue<unknown>;
const TableContext = createContext<InternalTableContextValue | undefined>(undefined);

export const useTableContext = <T,>(): { state: UseTableResult<T>; data: T[] } => {
    const ctx = useContext(TableContext);
    if (!ctx) throw new Error('Table components must be used inside <AccordionTable>');
    return ctx as TableContextValue<T>;
};

const AccordionTableInner = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    ...props
}: UseTableParams<T> & React.HTMLAttributes<HTMLTableElement>) => {
    const ref = useRef<HTMLTableElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const el = ref.current;
        const parent = el?.parentElement ?? null;
        const update = () => setContainerWidth(measureParentWidth(el));
        update();
        if (!parent) return;
        const ro = new ResizeObserver(update);
        ro.observe(parent);
        return () => ro.disconnect();
    }, []);

    const state = useTable<T>({
        columns,
        data,
        defaultColWidth,
        containerPaddingPx,
        containerWidth,
    } as UseTableParams<T> & { containerWidth: number });

    const value: TableContextValue<T> = { state, data };

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <table ref={ref} {...props} style={{ tableLayout: 'fixed', width: '100%' }} />
        </TableContext.Provider>
    );
};

type AccordionTableStatics = {
    Body: typeof Body;
    BodyRows: typeof BodyRows;
    Cell: typeof Cell;
    ColGroup: typeof ColGroup;
    GroupHeader: typeof GroupHeader;
    Header: typeof Header;
    HeaderRows: typeof HeaderRows;
    Row: typeof Row;
    Details: typeof Details;
    Toggle: typeof Toggle;
    Th: typeof Th;
};

const AccordionTable = AccordionTableInner as typeof AccordionTableInner & AccordionTableStatics;

AccordionTable.Body = Body;
AccordionTable.BodyRows = BodyRows;
AccordionTable.Cell = Cell;
AccordionTable.ColGroup = ColGroup;
AccordionTable.GroupHeader = GroupHeader;
AccordionTable.Header = Header;
AccordionTable.HeaderRows = HeaderRows;
AccordionTable.Row = Row;
AccordionTable.Details = Details;
AccordionTable.Toggle = Toggle;
AccordionTable.Th = Th;

export default AccordionTable;
