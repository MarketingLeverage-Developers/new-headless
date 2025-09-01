import React from 'react';
import { usePagination, type PaginationValueType } from '../../Pagination';

type FastNextProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    onFastNextClick?: (v: PaginationValueType) => void;
};

export const FastNext: React.FC<FastNextProps> = ({ children, onFastNextClick, ...props }) => {
    const { fastNext, hasFastNextPage } = usePagination();
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
        const v = fastNext();
        onFastNextClick?.(v);
        props.onClick?.(e);
    };
    return (
        <button disabled={!hasFastNextPage} onClick={handle} aria-label="fast-next" {...props}>
            {children}
        </button>
    );
};
