import type { HTMLAttributes } from 'react';

type DetailsItemProps = {
    label: React.ReactNode;
    children: React.ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export const DetailsItem: React.FC<DetailsItemProps> = ({ label, children, ...props }: DetailsItemProps) => (
    <div {...props}>
        <div>{label}</div>
        <div>{children}</div>
    </div>
);
