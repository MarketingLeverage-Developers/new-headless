import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Container } from './components/Container';
import { Header } from './components/Header';
import { Body } from './components/Body';
import { Ghost } from './components/Ghost';
import { ColumnVisibilityControl } from './components/ColumnVisibilityControl';
import RowToggle from './components/RowToggle';
import { ColumnSelectBoxPortal } from './components/ColumnSelectBoxPortal';

import { useContainerWidth } from './hooks/useContainerWidth';
import { useLastPointerPosition } from './hooks/useLastPointerPosition';
import { useSelectionRange } from './hooks/useSelectionRange';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useColumnResize } from './hooks/useColumnResize';
import { useColumnDrag } from './hooks/useColumnDrag';
import { useSelectionMouseUpEnd } from './hooks/useSelectionMouseUpEnd';
import { useCopySelection } from './hooks/useCopySelection';
import { usePinnedStyle } from './hooks/usePinnedStyle';
import { useGridMeta } from './hooks/useGridMeta';
import { useGridPointer } from './hooks/useGridPointer';
import { CellContextMenuPortal } from './components/CellContextMenuPortal';

import { useFlattenRows } from './hooks/useFlattenRows';
import { useTableColumnsState } from './hooks/useTableColumnState';

/* =========================
   Types
   ========================= */

export type CellRenderMeta<T> = {
    rowKey: string;
    ri: number;
    level: number;
    toggleRowExpanded: (rowKey: string) => void;
    isRowExpanded: (rowKey: string) => boolean;
};

export interface ColumnType<T> {
    key: string;
    label?: string;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
}

export type Column<T> = {
    key: string;
    label?: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
};

export type AirTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    rowKeyField?: keyof T;
    defaultColWidth?: number;

    detailRenderer?: (params: { row: T; ri: number }) => React.ReactNode;

    getRowCanExpand?: (row: T, ri: number) => boolean;
    getRowStyle?: (row: T, index: number) => { backgroundColor?: string };

    storageKey?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;

    pinnedColumnKeys?: string[];
    onPinnedColumnKeysChange?: (keys: string[]) => void;

    getExpandedRows?: (row: T, ri: number) => T[];
    getRowLevel?: (row: T, ri: number) => number;
};

export type DragGhost = {
    key: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    leftInGrid: number;
    topInGrid: number;
};

export type CellPos = { ri: number; ci: number };
export type SelectionState = {
    start: CellPos | null;
    end: CellPos | null;
    isSelecting: boolean;
};

export const MIN_COL_WIDTH = 80;

export type DragState = {
    draggingKey: string | null;
    dragX: number;
    previewOrder: string[] | null;
    version: number;
};

export type UseTableResult<T> = {
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
        level: number;
        cells: {
            key: string;
            render: (item: T, rowIndex: number, meta: CellRenderMeta<T>) => React.ReactElement;
        }[];
    }[];

    columnOrder: string[];
    visibleColumnKeys: string[];
    setVisibleColumnKeys: (keys: string[]) => void;

    drag: DragState;
    startColumnDrag: (key: string, startX: number) => void;
    updateColumnDrag: (x: number) => void;
    setPreviewOrder: (order: string[] | null) => void;
    endColumnDrag: () => void;

    resizeColumn: (colKey: string, width: number) => void;
    commitColumnOrder: (order: string[]) => void;

    pinnedColumnKeys: string[];
    setPinnedColumnKeys: (keys: string[]) => void;
};

/* =========================
   Context
   ========================= */

type AirTableContextValue<T> = {
    props: AirTableProps<T>;
    wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;
    tableAreaRef: React.MutableRefObject<HTMLDivElement | null>;
    state: UseTableResult<T>;

    baseOrder: string[];
    gridTemplateColumns: string;
    widthByKey: Record<string, number>;
    baseXByKey: Record<string, number>;
    offsetByKey: Record<string, number>;

    ghost: DragGhost | null;
    setGhost: React.Dispatch<React.SetStateAction<DragGhost | null>>;

    headerScrollLeft: number;
    setHeaderScrollLeft: React.Dispatch<React.SetStateAction<number>>;

    selection: SelectionState;
    setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;

    resizeRef: React.MutableRefObject<{ key: string; startX: number; startWidth: number } | null>;
    lastMouseClientRef: React.MutableRefObject<{ x: number; y: number } | null>;
    disableShiftAnimationRef: React.MutableRefObject<boolean>;

    getXInGrid: (clientX: number) => number;
    getYInGrid: (clientY: number) => number;
    getShiftStyle: (colKey: string) => React.CSSProperties;
    calcInsertIndex: (x: number, dragging: string) => number;
    isInsideScrollAreaX: (clientX: number) => boolean;

    getRange: () => { top: number; bottom: number; left: number; right: number } | null;
    isCellSelected: (ri: number, ci: number) => boolean;

    expandedRowKeys: Set<string>;
    toggleRowExpanded: (rowKey: string) => void;
    isRowExpanded: (rowKey: string) => boolean;

    getPinnedStyle: (colKey: string, bg?: string, options?: { isHeader?: boolean }) => React.CSSProperties;

    pinnedColumnKeys: string[];
    setPinnedColumnKeys: (keys: string[]) => void;
};

type Internal = AirTableContextValue<unknown>;
const Context = createContext<Internal | undefined>(undefined);

export const useAirTableContext = <T,>(): AirTableContextValue<T> => {
    const ctx = useContext(Context);
    if (!ctx) throw new Error('AirTable components must be used inside <AirTable>');
    return ctx as AirTableContextValue<T>;
};

/* =========================
   AirTable Component
   ========================= */

const AirTableInner = <T,>({
    data,
    columns,
    rowKeyField,
    defaultColWidth = 160,
    detailRenderer,
    getRowStyle,
    getRowCanExpand,
    storageKey,
    style,
    children,
    pinnedColumnKeys: initialPinnedColumnKeys = [],
    onPinnedColumnKeysChange,
    getExpandedRows,
    getRowLevel,
}: AirTableProps<T>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const tableAreaRef = useRef<HTMLDivElement | null>(null);

    const containerWidth = useContainerWidth(wrapperRef);

    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(() => new Set());

    const toggleRowExpanded = useCallback((rowKey: string) => {
        setExpandedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const isRowExpanded = useCallback((rowKey: string) => expandedRowKeys.has(rowKey), [expandedRowKeys]);

    const columnState = useTableColumnsState<T>({
        columns,
        data,
        defaultColWidth,
        containerWidth,
        rowKeyField: rowKeyField ? String(rowKeyField) : undefined,
        storageKey,
        initialPinnedColumnKeys,
        onPinnedColumnKeysChange,
    });

    const { columnRow, columnOrder, visibleColumnKeys, setVisibleColumnKeys, orderedLeafColumns } = columnState;

    const { rows } = useFlattenRows<T>({
        data,
        orderedLeafColumns,
        visibleColumnKeys,
        rowKeyField: rowKeyField ? String(rowKeyField) : undefined,
        getRowLevel,
        getExpandedRows,
        expandedRowKeys,
    });

    const [drag, setDrag] = useState<DragState>({
        draggingKey: null,
        dragX: 0,
        previewOrder: null,
        version: 0,
    });

    const startColumnDrag = useCallback((key: string, startX: number) => {
        setDrag({ draggingKey: key, dragX: startX, previewOrder: null, version: 0 });
    }, []);

    const updateColumnDrag = useCallback((x: number) => {
        setDrag((prev) => ({ ...prev, dragX: x }));
    }, []);

    const setPreviewOrder = useCallback((order: string[] | null) => {
        setDrag((prev) => ({ ...prev, previewOrder: order, version: prev.version + 1 }));
    }, []);

    const endColumnDrag = useCallback(() => {
        setDrag({ draggingKey: null, dragX: 0, previewOrder: null, version: 0 });
    }, []);

    const visibleKeys = useMemo(() => columnRow.columns.map((c) => c.key), [columnRow.columns]);

    const widthByKey = useMemo(() => {
        const map: Record<string, number> = {};
        columnRow.columns.forEach((c) => (map[c.key] = c.width));
        return map;
    }, [columnRow.columns]);

    const { pinnedColumnKeys, setPinnedColumnKeys, resizeColumn, commitColumnOrder } = columnState;

    const { baseOrder, gridTemplateColumns, baseXByKey, offsetByKey, tableMinWidthPx } = useGridMeta({
        columnOrder,
        visibleKeys,
        widthByKey,
        defaultColWidth,
        pinnedColumnKeys,
        dragPreviewOrder: drag.previewOrder,
    });

    const { getXInGrid, getYInGrid, isInsideScrollAreaX, calcInsertIndex } = useGridPointer({
        wrapperRef,
        scrollRef,
        baseOrder,
        baseXByKey,
        widthByKey,
        defaultColWidth,
    });

    const [ghost, setGhost] = useState<DragGhost | null>(null);
    const [headerScrollLeft, setHeaderScrollLeft] = useState(0);

    const disableShiftAnimationRef = useRef(false);
    const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    const [selection, setSelection] = useState<SelectionState>({ start: null, end: null, isSelecting: false });

    const lastMouseClientRef = useLastPointerPosition();

    const getShiftStyle = useCallback(
        (colKey: string): React.CSSProperties => {
            const dx = offsetByKey[colKey] ?? 0;
            const transition = disableShiftAnimationRef.current
                ? 'none'
                : drag.draggingKey
                ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 240ms ease';
            return { transform: `translateX(${dx}px)`, transition, willChange: 'transform' };
        },
        [offsetByKey, drag.draggingKey]
    );

    const { getRange, isCellSelected } = useSelectionRange(selection);

    useAutoScroll({ scrollRef, lastMouseClientRef, enabled: selection.isSelecting || !!drag.draggingKey });

    useColumnResize({ resizeRef, getXInGrid, resizeColumn });

    useColumnDrag({
        dragKey: drag.draggingKey,
        resizeRef,
        dragPreviewOrder: drag.previewOrder,
        baseOrder,
        getXInGrid,
        getYInGrid,
        isInsideScrollAreaX,
        calcInsertIndex,
        updateColumnDrag,
        setGhost,
        setPreviewOrder,
        endColumnDrag,
        commitColumnOrder,
        disableShiftAnimationRef,
    });

    useSelectionMouseUpEnd({ drag, setSelection });

    useCopySelection({ stateRows: rows, baseOrder, getRange, draggingKey: drag.draggingKey });

    const { getPinnedStyle } = usePinnedStyle({ pinnedColumnKeys, baseXByKey });

    const state: UseTableResult<T> = {
        columnRow,
        rows,
        columnOrder,
        visibleColumnKeys,
        setVisibleColumnKeys,
        drag,
        startColumnDrag,
        updateColumnDrag,
        setPreviewOrder,
        endColumnDrag,
        resizeColumn,
        commitColumnOrder,
        pinnedColumnKeys,
        setPinnedColumnKeys,
    };

    const value = {
        props: {
            data,
            columns,
            rowKeyField,
            defaultColWidth,
            detailRenderer,
            getRowStyle,
            storageKey,
            style,
            children,
            getRowCanExpand,
            pinnedColumnKeys,
            onPinnedColumnKeysChange,
            getExpandedRows,
            getRowLevel,
        },
        wrapperRef,
        scrollRef,
        tableAreaRef,
        state,

        baseOrder,
        gridTemplateColumns,
        widthByKey,
        baseXByKey,
        offsetByKey,

        ghost,
        setGhost,

        headerScrollLeft,
        setHeaderScrollLeft,

        selection,
        setSelection,

        resizeRef,
        lastMouseClientRef,
        disableShiftAnimationRef,

        getXInGrid,
        getYInGrid,
        getShiftStyle,
        calcInsertIndex,
        isInsideScrollAreaX,

        getRange,
        isCellSelected,

        expandedRowKeys,
        toggleRowExpanded,
        isRowExpanded,

        getPinnedStyle,

        pinnedColumnKeys,
        setPinnedColumnKeys,
    };

    return (
        <Context.Provider value={value as any}>
            <div
                ref={wrapperRef}
                style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    ...style,
                }}
            >
                {children ?? (
                    <>
                        <ColumnVisibilityControl portalId="column-select-box-portal" />
                        <Container>
                            <div
                                style={{
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 30,
                                    background: '#fff',
                                    minWidth: `${tableMinWidthPx}px`,
                                }}
                            >
                                <Header />
                            </div>

                            <Body />
                            <Ghost />
                        </Container>
                    </>
                )}
                <CellContextMenuPortal />
            </div>
        </Context.Provider>
    );
};

const AirTable = AirTableInner as typeof AirTableInner & {
    Container: typeof Container;
    Header: typeof Header;
    Body: typeof Body;
    Ghost: typeof Ghost;
    RowToggle: typeof RowToggle;
    ColumnSelectBoxPortal: typeof ColumnSelectBoxPortal;
    CellContextMenuPortal: typeof CellContextMenuPortal;
};

AirTable.Container = Container;
AirTable.Header = Header;
AirTable.Body = Body;
AirTable.Ghost = Ghost;
AirTable.RowToggle = RowToggle;
AirTable.ColumnSelectBoxPortal = ColumnSelectBoxPortal;
AirTable.CellContextMenuPortal = CellContextMenuPortal;

export default AirTable;
