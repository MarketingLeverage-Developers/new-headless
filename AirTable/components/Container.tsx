import React from 'react';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

export const Container = ({ className, children, ...rest }: ContainerProps) => (
    <div className={className} {...rest}>
        {children}
    </div>
);
