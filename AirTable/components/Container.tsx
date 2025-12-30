import React from 'react';
import { useAirTableContext } from '../AirTable';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

export const Container = ({ className, children, style, ...rest }: ContainerProps) => {
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
                minWidth: 0, // ✅ flex 가로 overflow 방지 핵심
                position: 'relative',
                ...style,
            }}
            {...rest}
        >
            {/* ✅✅✅ 유일한 scroll 컨테이너 */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0, // ✅ 내부 fit-content가 부모를 밀어내는 현상 방지
                    overflow: 'auto',
                    position: 'relative',
                }}
            >
                {children}
            </div>
        </div>
    );
};
