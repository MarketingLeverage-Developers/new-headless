import React from 'react';
import { usePagination, type PaginationValueType } from '../../Pagination';

type PrevProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    onPrevClick?: (v: PaginationValueType) => void;
};

export const Prev: React.FC<PrevProps> = ({ children, onPrevClick, ...props }) => {
    const { prev, hasPrevPage } = usePagination();
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
        const v = prev();
        onPrevClick?.(v);
        props.onClick?.(e);
    };
    return (
        <button disabled={!hasPrevPage} onClick={handle} {...props}>
            {children}
        </button>
    );
};
