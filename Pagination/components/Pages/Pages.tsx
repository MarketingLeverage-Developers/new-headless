import React from 'react';
import { usePagination, type PaginationValueType } from '../../Pagination';

type PagesProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPagesClick?: (v: PaginationValueType) => void;
    activeClassName?: string;
};

export const Pages: React.FC<PagesProps> = ({ onPagesClick, activeClassName = '', ...props }) => {
    const { value, setPage, startPage, endPage } = usePagination();
    const handle = (p: number) => {
        const v = setPage(p);
        onPagesClick?.(v);
    };
    return (
        <>
            {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                const p = startPage + i;
                const isActive = p === value.page;
                const cn = `${props.className ?? ''} ${isActive ? activeClassName : ''}`.trim();
                return (
                    <button key={p} onClick={() => handle(p)} disabled={isActive} {...props} className={cn}>
                        {p}
                    </button>
                );
            })}
        </>
    );
};
