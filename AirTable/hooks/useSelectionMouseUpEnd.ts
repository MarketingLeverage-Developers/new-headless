import { useEffect } from 'react';
import type { DragState, SelectionState } from '../AirTable';

export const useSelectionMouseUpEnd = ({
    drag,
    setSelection,
}: {
    drag: DragState;
    setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;
}) => {
    useEffect(() => {
        const handleUp = () => {
            if (drag.draggingKey) return;
            setSelection((prev) => ({ ...prev, isSelecting: false }));
        };

        window.addEventListener('mouseup', handleUp);
        return () => window.removeEventListener('mouseup', handleUp);
    }, [drag.draggingKey, setSelection]);
};
