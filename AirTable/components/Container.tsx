// src/shared/headless/AirTable/components/Container.tsx
import React, { useEffect, useMemo } from 'react';
import { useAirTableContext } from '../AirTable';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    height?: number | string;
};

const toCssSize = (v?: number | string) => {
    if (typeof v === 'number') return `${v}px`;
    return v;
};

const findScrollableParent = (el: HTMLElement | null) => {
    let parent = el?.parentElement ?? null;

    while (parent) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;

        const canScrollY = overflowY === 'auto' || overflowY === 'scroll';
        if (canScrollY && parent.scrollHeight > parent.clientHeight + 1) return parent;

        parent = parent.parentElement;
    }

    return null;
};

export const Container = ({ className, children, style, height = '100%', ...rest }: ContainerProps) => {
    const { scrollRef } = useAirTableContext<any>();

    const mergedStyle = useMemo<React.CSSProperties>(
        () => ({
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: toCssSize(height) ?? '100%',
            minHeight: 0,
            minWidth: 0,
            position: 'relative',
            ...style,
        }),
        [style, height]
    );

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const parentScrollEl = findScrollableParent(el);
        if (!parentScrollEl) return;

        /** ✅✅✅ 핵심: 외부 스크롤 전달 속도 (0.55~0.75 추천) */
        const TRANSFER_RATE = 0.65;

        const onWheel = (e: WheelEvent) => {
            // ✅ 가로 스크롤 의도면 그대로 둠
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

            const { scrollTop, scrollHeight, clientHeight } = el;

            const atTop = scrollTop <= 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

            const goingUp = e.deltaY < 0;
            const goingDown = e.deltaY > 0;

            const hitTop = atTop && goingUp;
            const hitBottom = atBottom && goingDown;

            // ✅ 내부가 더 이상 움직일 수 없을 때만 부모 scroll로 넘김
            if (hitTop || hitBottom) {
                e.preventDefault();

                // ✅✅✅ 외부 스크롤 델타 감쇠 적용
                parentScrollEl.scrollTop += e.deltaY * TRANSFER_RATE;
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [scrollRef]);

    return (
        <div className={className} style={mergedStyle} {...rest}>
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
        </div>
    );
};
