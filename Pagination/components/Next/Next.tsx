import React from 'react';
import { usePagination, type PaginationValueType } from '../../Pagination';

type NextProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    onNextClick?: (v: PaginationValueType) => void;
};

export const Next: React.FC<NextProps> = ({ children, onNextClick, ...props }) => {
    const { next, hasNextPage } = usePagination();
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
        const v = next();
        onNextClick?.(v);
        props.onClick?.(e);
    };
    return (
        <button disabled={!hasNextPage} onClick={handle} {...props}>
            {children}
        </button>
    );
};
