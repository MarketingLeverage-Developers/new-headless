import React from 'react';
import { usePagination, type PaginationValueType } from '../../Pagination';

type FastPrevProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    onFastPrevClick?: (v: PaginationValueType) => void;
};

export const FastPrev: React.FC<FastPrevProps> = ({ children, onFastPrevClick, ...props }) => {
    const { fastPrev, hasFastPrevPage } = usePagination();
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
        const v = fastPrev();
        onFastPrevClick?.(v);
        props.onClick?.(e);
    };
    return (
        <button disabled={!hasFastPrevPage} onClick={handle} aria-label="fast-prev" {...props}>
            {children}
        </button>
    );
};
