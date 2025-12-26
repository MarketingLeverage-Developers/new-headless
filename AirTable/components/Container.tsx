import React from 'react';

type ContainerProps = {
    className?: string;
    children: React.ReactNode;
};

export const Container = ({ className, children }: ContainerProps) => <div className={className}>{children}</div>;
