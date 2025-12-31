import { useEffect } from 'react';

export const useColumnDrag = ({
    dragKey,
    resizeRef,
    dragPreviewOrder,
    baseOrder,
    getXInGrid,
    getYInGrid,
    isInsideScrollAreaX,
    calcInsertIndex,
    updateColumnDrag,
    setGhost,
    setPreviewOrder,
    endColumnDrag,
    commitColumnOrder,
    disableShiftAnimationRef,
}: {
    dragKey: string | null;
    resizeRef: React.MutableRefObject<{ key: string; startX: number; startWidth: number } | null>;
    dragPreviewOrder: string[] | null;
    baseOrder: string[];
    getXInGrid: (clientX: number) => number;
    getYInGrid: (clientY: number) => number;
    isInsideScrollAreaX: (clientX: number) => boolean;
    calcInsertIndex: (x: number, dragging: string) => number;
    updateColumnDrag: (x: number) => void;
    setGhost: React.Dispatch<React.SetStateAction<any>>;
    setPreviewOrder: (order: string[] | null) => void;
    endColumnDrag: () => void;
    commitColumnOrder: (order: string[]) => void;
    disableShiftAnimationRef: React.MutableRefObject<boolean>;
}) => {
    useEffect(() => {
        if (!dragKey) return;

        const finalize = () => {
            if (resizeRef.current) return;

            const final = dragPreviewOrder;

            if (!final || final.length === 0) {
                setPreviewOrder(null);
                endColumnDrag();
                setGhost(null);
                return;
            }

            disableShiftAnimationRef.current = true;
            commitColumnOrder(final);

            requestAnimationFrame(() => {
                disableShiftAnimationRef.current = false;
            });

            setPreviewOrder(null);
            endColumnDrag();
            setGhost(null);
        };

        const handleMove = (ev: MouseEvent) => {
            if (resizeRef.current) return;

            const x = getXInGrid(ev.clientX);
            const y = getYInGrid(ev.clientY);

            updateColumnDrag(x);

            setGhost((prev: any) => {
                if (!prev) return prev;
                return { ...prev, offsetX: x - prev.startX, offsetY: y - prev.startY };
            });

            if (!isInsideScrollAreaX(ev.clientX)) return;

            const insertIndex = calcInsertIndex(x, dragKey);

            const filtered = baseOrder.filter((k) => k !== dragKey);
            const next = [...filtered];
            next.splice(insertIndex, 0, dragKey);

            setPreviewOrder(next);
        };

        const handleUp = () => finalize();

        const handleBlur = () => finalize();
        const handleContextMenu = () => finalize();
        const handleDragEnd = () => finalize();
        const handlePointerUp = () => finalize();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finalize();
        };
        const handleVisibility = () => {
            if (document.hidden) finalize();
        };
        const handleDocMouseLeave = () => finalize();

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        window.addEventListener('blur', handleBlur);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('dragend', handleDragEnd);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('keydown', handleKeyDown);

        document.addEventListener('visibilitychange', handleVisibility);
        document.addEventListener('mouseleave', handleDocMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);

            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('dragend', handleDragEnd);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('keydown', handleKeyDown);

            document.removeEventListener('visibilitychange', handleVisibility);
            document.removeEventListener('mouseleave', handleDocMouseLeave);
        };
    }, [
        dragKey,
        dragPreviewOrder,
        resizeRef,
        baseOrder,
        getXInGrid,
        getYInGrid,
        isInsideScrollAreaX,
        calcInsertIndex,
        updateColumnDrag,
        setGhost,
        setPreviewOrder,
        endColumnDrag,
        commitColumnOrder,
        disableShiftAnimationRef,
    ]);
};
