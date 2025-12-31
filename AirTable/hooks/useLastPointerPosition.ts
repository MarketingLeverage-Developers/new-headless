import { useEffect, useRef } from 'react';

export const useLastPointerPosition = () => {
    const lastMouseClientRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleMove = (ev: PointerEvent) => {
            lastMouseClientRef.current = { x: ev.clientX, y: ev.clientY };
        };

        window.addEventListener('pointermove', handleMove);
        return () => window.removeEventListener('pointermove', handleMove);
    }, []);

    return lastMouseClientRef;
};
