import { createContext, useContext } from 'react';
import type { UseTableResult } from '../../Table';

// 각 행 타입
type RowType<T> = UseTableResult<T>['rows'][number];

// Row 디테일 컨텍스트에 담길 값
type RowDetails<T> = {
    row: RowType<T>;
    ri: number;
    opened: boolean;
    toggle: () => void;
};

type InternalRowDetails = RowDetails<unknown>;
const RowDetailsContext = createContext<InternalRowDetails | undefined>(undefined);

// 행 컨텍스트 훅
export const useRowDetails = <T,>(): RowDetails<T> => {
    const ctx = useContext(RowDetailsContext);
    if (!ctx) throw new Error('useRowDetails must be used inside a RowDetailsProvider');
    return ctx as RowDetails<T>;
};

// 행 컨텍스트 프로바이더
export const RowDetailsProvider = <T,>({ value, children }: { value: RowDetails<T>; children: React.ReactNode }) => (
    <RowDetailsContext.Provider value={value as InternalRowDetails}>{children}</RowDetailsContext.Provider>
);

// 디테일 렌더러 타입
export type DetailsRenderer<T> = (args: { row: RowType<T>; ri: number; state: UseTableResult<T> }) => React.ReactNode;

type InternalDetails = DetailsRenderer<unknown>;

// 기본 디테일 렌더러: 행 데이터를 그대로 보여주는 디버그 용도
const defaultDetailsRenderer: InternalDetails = ({ row }) => (
    <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <pre
            style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 12,
            }}
        >
            {JSON.stringify(row.item, null, 2)}
        </pre>
    </div>
);

const DetailsContext = createContext<InternalDetails>(defaultDetailsRenderer as InternalDetails);

// 현재 활성화된 디테일 렌더러 훅
export const useDetailsRenderer = <T,>(): DetailsRenderer<T> =>
    useContext(DetailsContext) as unknown as DetailsRenderer<T>;

type DetailsArgs<T> = { row: RowType<T>; ri: number; state: UseTableResult<T> };

const toInternal = <T,>(fn?: DetailsRenderer<T>): InternalDetails =>
    fn
        ? (((args: DetailsArgs<unknown>) => fn(args as DetailsArgs<T>)) as InternalDetails)
        : (defaultDetailsRenderer as InternalDetails);

// <Table.Details> 컴포넌트: 디테일 렌더러를 주입하는 Provider
export const Details = <T,>({ renderer, children }: { renderer?: DetailsRenderer<T>; children?: React.ReactNode }) => (
    <DetailsContext.Provider value={toInternal(renderer)}>{children ?? null}</DetailsContext.Provider>
);
