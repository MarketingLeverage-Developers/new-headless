import React, { createContext, useContext, useMemo } from 'react';
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

// ⬅️ re-export: Details 모듈의 훅/프로바이더를 Table 모듈에서 다시 내보내기
export {
    RowDetailsProvider,
    useDetailsRenderer,
    useRowDetails,
    type DetailsRenderer,
} from './components/Details/Details';

/* =========================
   Types
   ========================= */

export interface ColumnType<T> {
    key: string;
    render: (item: T, index: number) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string; // px 또는 %
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
    containerPaddingPx?: number; // 좌우 여백 등 보정치
};

export type UseTableResult<T> = {
    // 그룹 헤더용 데이터 구조
    groupColumnRow: {
        key: string;
        columns: {
            key: string;
            colSpan: number;
            render: (key: string, data?: T[]) => React.ReactElement;
        }[];
    };
    // 1단 헤더용 데이터 구조
    columnRow: {
        key: string;
        columns: {
            key: string;
            render: (key: string, data?: T[]) => React.ReactElement;
            width: number; // px 확정
        }[];
    };
    // 실제 바디 행 데이터 구조 (이제 hiddenCells 없음)
    rows: {
        key: string;
        item: T;
        cells: {
            key: string;
            render: (item: T, rowIndex: number) => React.ReactElement;
        }[];
    }[];
    // <col> 스타일 계산용 헬퍼
    getColStyle: (colIndex: number) => React.CSSProperties;
};

/* =========================
   Helpers
   ========================= */

// width 설정값을 px 숫자로 변환하는 헬퍼
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

// 부모 요소의 content-box width 계산
const measureParentWidth = (el: HTMLTableElement | null) => {
    if (!el || !el.parentElement) return 0;
    const parent = el.parentElement;

    const cs = getComputedStyle(parent);
    const padL = parseFloat(cs.paddingLeft || '0');
    const padR = parseFloat(cs.paddingRight || '0');

    const contentBoxWidth = parent.clientWidth - padL - padR;
    return Math.max(0, contentBoxWidth);
};

/* =========================
   Hook: useTable
   - 모든 컬럼을 그대로 렌더링 (더 이상 뷰포트에 따른 숨김 처리 없음)
   ========================= */

export const useTable = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    containerWidth,
}: UseTableParams<T> & { containerWidth: number }): UseTableResult<T> => {
    // children 포함 모든 leaf 컬럼을 1차원 배열로 평탄화
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

    // 컨테이너 내 실제 사용가능 폭 (px)
    const innerWidth = Math.max(0, containerWidth - containerPaddingPx);

    // 각 leaf의 실제 px 폭 계산 (px / % 모두 지원)
    const leafWidthsPx = useMemo(
        () => leafColumns.map((c) => toNumberPx(c.width, defaultColWidth, innerWidth)),
        [leafColumns, defaultColWidth, innerWidth]
    );

    // 더 이상 컬럼을 자르지 않고 전체 leafColumns를 모두 사용
    const columnRow = useMemo(
        () => ({
            key: 'column',
            columns: leafColumns.map((c, idx) => ({
                key: c.key,
                render: () => c.header(c.key, data),
                width: Math.round(leafWidthsPx[idx] ?? defaultColWidth),
            })),
        }),
        [leafColumns, leafWidthsPx, data, defaultColWidth]
    );

    // 그룹 헤더 colSpan 계산 (모든 leaf 기준)
    const groupColumnRow = useMemo(() => {
        const leafKeys = new Set(leafColumns.map((c) => c.key));
        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                const span = col.children.filter((ch) => leafKeys.has(ch.key)).length;
                return span;
            }
            return leafKeys.has(col.key) ? 1 : 0;
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
    }, [columns, data, leafColumns]);

    // 각 행에 대해 visible leaf 컬럼만 셀로 구성 (hiddenCells 제거)
    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => ({
                key: `row-${rowIndex}`,
                item,
                cells: leafColumns.map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number) => leaf.render(it, idx),
                })),
            })),
        [data, leafColumns]
    );

    // <col> 스타일 계산
    const getColStyle = (colIndex: number) => {
        const w = columnRow.columns[colIndex]?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

    return { groupColumnRow, columnRow, rows, getColStyle };
};

/* =========================
   Table Context
   ========================= */

export type TableContextValue<T> = { state: UseTableResult<T>; data: T[] };
type InternalTableContextValue = TableContextValue<unknown>;
const TableContext = createContext<InternalTableContextValue | undefined>(undefined);

export const useTableContext = <T,>(): { state: UseTableResult<T>; data: T[] } => {
    const ctx = useContext(TableContext);
    if (!ctx) throw new Error('Table components must be used inside <Table>');
    return ctx as TableContextValue<T>;
};

/* =========================
   TableInner
   - 부모 width 측정 + useTable 호출 + Context 제공
   ========================= */

const TableInner = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    ...props
}: UseTableParams<T> & React.HTMLAttributes<HTMLTableElement>) => {
    // const ref = useRef<HTMLTableElement | null>(null);
    // const [containerWidth, setContainerWidth] = useState<number>(0);

    // useEffect(() => {
    //     const el = ref.current;
    //     const parent = el?.parentElement ?? null;
    //     const update = () => setContainerWidth(measureParentWidth(el));
    //     update();
    //     if (!parent) return;
    //     const ro = new ResizeObserver(update);
    //     ro.observe(parent);
    //     return () => ro.disconnect();
    // }, []);

    const state = useTable<T>({
        columns,
        data,
        defaultColWidth,
        containerPaddingPx,
        // containerWidth,
    } as UseTableParams<T> & { containerWidth: number });

    const value: TableContextValue<T> = { state, data };

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <table {...props} style={{ tableLayout: 'fixed', width: '100%' }} />
        </TableContext.Provider>
    );
};

/* =========================
   합성 파츠 바인딩
   ========================= */

type TableStatics = {
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

const Table = TableInner as typeof TableInner & TableStatics;

Table.Body = Body;
Table.BodyRows = BodyRows;
Table.Cell = Cell;
Table.ColGroup = ColGroup;
Table.GroupHeader = GroupHeader;
Table.Header = Header;
Table.HeaderRows = HeaderRows;
Table.Row = Row;
Table.Details = Details;
Table.Toggle = Toggle;
Table.Th = Th;

export default Table;
