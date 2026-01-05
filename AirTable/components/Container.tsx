// src/shared/headless/AirTable/components/Container.tsx
import React, { useMemo } from 'react';
import { useAirTableContext } from '../AirTable';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    useScrollContainer?: boolean;
    height?: number | string; // ✅✅✅ 추가
};

const toCssSize = (v?: number | string) => {
    if (typeof v === 'number') return `${v}px`;
    return v;
};

export const Container = ({
    className,
    children,
    style,
    useScrollContainer = true,
    height,
    ...rest
}: ContainerProps) => {
    const { scrollRef } = useAirTableContext<any>();

    /**
     * ✅ 핵심 규칙
     * - height prop이 있으면 그걸 최우선으로 적용
     * - height prop이 없으면 기본은 100%
     * - style은 height를 제외하고 나머지만 merge
     */
    const mergedStyle = useMemo<React.CSSProperties>(() => {
        const resolvedHeight = toCssSize(height) ?? '100%';

        return {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: resolvedHeight, // ✅✅✅ 핵심: height prop 기반
            minHeight: 0,
            minWidth: 0,
            position: 'relative',

            /**
             * ✅ style merge
             * - 단, style.height가 있다면 height prop과 충돌할 수 있으니,
             *   height prop이 존재하면 style.height는 무시하고 싶다.
             */
            ...(height ? Object.fromEntries(Object.entries(style ?? {}).filter(([k]) => k !== 'height')) : style),
        };
    }, [style, height]);

    return (
        <div className={className} style={mergedStyle} {...rest}>
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
