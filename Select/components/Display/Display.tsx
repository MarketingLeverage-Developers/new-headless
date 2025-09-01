import React from 'react';
import { useSelect } from '../../Select';

type SelectGroupDisplayProps = React.HTMLAttributes<HTMLDivElement> & {
    render?: (value: string) => React.ReactNode;
};

export const Display = ({ render, ...props }: SelectGroupDisplayProps) => {
    const { selectValue } = useSelect();

    return <div {...props}>{render && render(selectValue)}</div>;
};
