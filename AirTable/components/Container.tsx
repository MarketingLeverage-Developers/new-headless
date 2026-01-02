// src/shared/headless/AirTable/components/Container.tsx
import React from 'react';
import { useAirTableContext } from '../AirTable';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    useScrollContainer?: boolean; // ✅ 추가
};

export const Container = ({ className, children, style, useScrollContainer = true, ...rest }: ContainerProps) => {
    const { scrollRef } = useAirTableContext<any>();

    return (
        <div
            className={className}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                minHeight: 0,
                minWidth: 0,
                position: 'relative',
                ...style,
            }}
            {...rest}
        >
            {useScrollContainer ? (
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        minWidth: 0,
                        overflow: 'auto',
                        position: 'relative',
                    }}
                >
                    {children}
                </div>
            ) : (
                <>{children}</>
            )}
        </div>
    );
};
