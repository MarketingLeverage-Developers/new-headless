import { createContext, useContext } from 'react';
import type { UseTableResult } from '../../AccordionTable';

type RowType<T> = UseTableResult<T>['rows'][number];

type RowDetails<T> = {
    row: RowType<T>;
    ri: number;
    opened: boolean;
    hasHidden: boolean;
    toggle: () => void;
};

type InternalRowDetails = RowDetails<unknown>;
const RowDetailsContext = createContext<InternalRowDetails | undefined>(undefined);

export const useRowDetails = <T,>(): RowDetails<T> => {
    const ctx = useContext(RowDetailsContext);
    if (!ctx) throw new Error('useRowDetails must be used inside a RowDetailsProvider');
    return ctx as RowDetails<T>;
};

export const RowDetailsProvider = <T,>({ value, children }: { value: RowDetails<T>; children: React.ReactNode }) => (
    <RowDetailsContext.Provider value={value as InternalRowDetails}>{children}</RowDetailsContext.Provider>
);

export type DetailsRenderer<T> = (args: { row: RowType<T>; ri: number; state: UseTableResult<T> }) => React.ReactNode;

type InternalDetails = DetailsRenderer<unknown>;

const defaultDetailsRenderer: InternalDetails = () => null;

const DetailsContext = createContext<InternalDetails>(defaultDetailsRenderer as InternalDetails);

export const useDetailsRenderer = <T,>(): DetailsRenderer<T> =>
    useContext(DetailsContext) as unknown as DetailsRenderer<T>;

type DetailsArgs<T> = { row: RowType<T>; ri: number; state: UseTableResult<T> };

const toInternal = <T,>(fn?: DetailsRenderer<T>): InternalDetails =>
    fn
        ? (((args: DetailsArgs<unknown>) => fn(args as DetailsArgs<T>)) as InternalDetails)
        : (defaultDetailsRenderer as InternalDetails);

export const Details = <T,>({ renderer, children }: { renderer?: DetailsRenderer<T>; children?: React.ReactNode }) => (
    <DetailsContext.Provider value={toInternal(renderer)}>{children ?? null}</DetailsContext.Provider>
);
