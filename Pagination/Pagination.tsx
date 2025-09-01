import React, { createContext, useContext, useMemo, useState } from 'react';
import { FastNext, FastPrev, Next, Pages, Prev } from './components';

export type PaginationValueType = {
    page: number;
    size: number;
    total: number;
};

type PaginationContextType = {
    value: PaginationValueType;
    setPage: (page: number) => PaginationValueType;
    prev: () => PaginationValueType;
    next: () => PaginationValueType;
    fastPrev: () => PaginationValueType;
    fastNext: () => PaginationValueType;
    setSize: (size: number) => PaginationValueType;
    totalPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    hasFastPrevPage: boolean;
    hasFastNextPage: boolean;
    startPage: number;
    endPage: number;
    maxPageButtons: number;
};

const PaginationContext = createContext<PaginationContextType>({
    value: { page: 1, size: 10, total: 0 },
    setPage: () => ({ page: 1, size: 10, total: 0 }),
    prev: () => ({ page: 1, size: 10, total: 0 }),
    next: () => ({ page: 1, size: 10, total: 0 }),
    fastPrev: () => ({ page: 1, size: 10, total: 0 }),
    fastNext: () => ({ page: 1, size: 10, total: 0 }),
    setSize: () => ({ page: 1, size: 10, total: 0 }),
    totalPage: 1,
    hasPrevPage: false,
    hasNextPage: false,
    hasFastPrevPage: false,
    hasFastNextPage: false,
    startPage: 1,
    endPage: 1,
    maxPageButtons: 5,
});

export const usePagination = () => useContext(PaginationContext);

type PaginationProps = {
    children?: React.ReactNode;
    value?: PaginationValueType;
    onChange?: (v: PaginationValueType) => void;
    defaultValue?: PaginationValueType;
    maxPageButtons?: number;
};

const normalize = (v: PaginationValueType): PaginationValueType => {
    const size = Math.max(1, Number.isFinite(v.size) ? v.size : 1);
    const totalPage = Math.max(1, Math.ceil((v.total ?? 0) / size));
    const page = Math.min(Math.max(1, v.page || 1), totalPage);
    const total = Math.max(0, v.total || 0);
    return { page, size, total };
};

const Pagination: React.FC<PaginationProps> & {
    Prev: typeof Prev;
    Next: typeof Next;
    Pages: typeof Pages;
    FastPrev: typeof FastPrev;
    FastNext: typeof FastNext;
} = ({ children, value, onChange, defaultValue, maxPageButtons = 5 }) => {
    const isControlled = value !== undefined;
    const [inner, setInner] = useState<PaginationValueType>(normalize(defaultValue ?? { page: 1, size: 10, total: 0 }));
    const current = normalize(isControlled ? (value as PaginationValueType) : inner);
    const maxButtons = Math.max(1, maxPageButtons);

    const update = (nv: PaginationValueType) => {
        const next = normalize(nv);
        if (!isControlled) setInner(next);
        onChange?.(next);
        return next;
    };

    const totalPage = Math.max(1, Math.ceil(current.total / current.size));
    const hasPrevPage = current.page > 1;
    const hasNextPage = current.page < totalPage;

    let startPage = Math.max(1, current.page - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;
    if (endPage > totalPage) {
        endPage = totalPage;
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    const hasFastPrevPage = startPage > 1;
    const hasFastNextPage = endPage < totalPage;

    const setPage = (page: number) => update({ ...current, page });
    const prev = () => update({ ...current, page: Math.max(1, current.page - 1) });
    const next = () => update({ ...current, page: Math.min(totalPage, current.page + 1) });
    const fastPrev = () => update({ ...current, page: Math.max(1, current.page - maxButtons) });
    const fastNext = () => update({ ...current, page: Math.min(totalPage, current.page + maxButtons) });
    const setSize = (size: number) => update({ page: 1, size, total: current.total });

    const ctx = useMemo(
        () => ({
            value: current,
            setPage,
            prev,
            next,
            fastPrev,
            fastNext,
            setSize,
            totalPage,
            hasPrevPage,
            hasNextPage,
            hasFastPrevPage,
            hasFastNextPage,
            startPage,
            endPage,
            maxPageButtons: maxButtons,
        }),
        [current, totalPage, hasPrevPage, hasNextPage, hasFastPrevPage, hasFastNextPage, startPage, endPage, maxButtons]
    );

    return <PaginationContext.Provider value={ctx}>{children}</PaginationContext.Provider>;
};

Pagination.Prev = Prev;
Pagination.Next = Next;
Pagination.Pages = Pages;
Pagination.FastPrev = FastPrev;
Pagination.FastNext = FastNext;

export default Pagination;
