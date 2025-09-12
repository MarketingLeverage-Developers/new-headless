import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, CSSProperties } from 'react';
import { useAccordion } from '../Accordion';

type HiddenProps = HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    transitionMs?: number;
    unmountOnClose?: boolean;
};

export const Hidden = ({ children, style, transitionMs = 200, unmountOnClose = false, ...props }: HiddenProps) => {
    const { accordionValue } = useAccordion();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [maxHeight, setMaxHeight] = useState<number>(0);
    const [mounted, setMounted] = useState<boolean>(accordionValue || !unmountOnClose);

    // 닫힐 때 언마운트(옵션)
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (accordionValue) {
            setMounted(true);
        } else if (unmountOnClose) {
            timeoutId = setTimeout(() => setMounted(false), transitionMs);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [accordionValue, unmountOnClose, transitionMs]);

    // 높이 측정 + 동적 콘텐츠 대응
    useEffect(() => {
        const measure = () => {
            const el = contentRef.current;
            if (!el) return;
            setMaxHeight(el.scrollHeight);
        };

        measure();

        // ResizeObserver 안전 생성
        const RO = (typeof window !== 'undefined' && (window as any).ResizeObserver) as
            | (new (cb: ResizeObserverCallback) => ResizeObserver)
            | undefined;

        let ro: ResizeObserver | null = null;
        if (RO && contentRef.current) {
            ro = new RO(() => measure());
            ro.observe(contentRef.current);
        }

        return () => {
            if (ro) ro.disconnect();
        };
        // children이 바뀌거나 열림/닫힘이 바뀔 때 재측정
    }, [children, accordionValue]);

    const baseStyle: CSSProperties = {
        overflow: 'hidden',
        transition: `max-height ${transitionMs}ms ease`,
        maxHeight: accordionValue ? maxHeight : 0,
        willChange: 'max-height',
        ...style,
    };

    return (
        <div style={baseStyle} {...props}>
            <div ref={contentRef} aria-hidden={!accordionValue}>
                {mounted ? children : null}
            </div>
        </div>
    );
};
