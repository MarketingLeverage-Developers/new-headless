import React from 'react';
import { useManySelect, type ManySelectValue } from '../../ManySelect';

type ItemProps = React.HTMLAttributes<HTMLDivElement> & {
    value: string;
    onClick?: (value: ManySelectValue) => void;
    children?: React.ReactNode;
};

export const Item: React.FC<ItemProps> = ({ value, onClick, children, ...props }) => {
    const { toggleManySelectValue } = useManySelect();
    const handle = () => {
        const next = toggleManySelectValue(value);
        onClick?.(next);
    };
    return (
        <div {...props} onClick={handle}>
            {children}
        </div>
    );
};
