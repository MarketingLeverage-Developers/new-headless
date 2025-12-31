import { useCallback } from 'react';
import type { SelectionState } from '../AirTable';

export const useSelectionRange = (selection: SelectionState) => {
    const getRange = useCallback(() => {
        if (!selection.start || !selection.end) return null;
        return {
            top: Math.min(selection.start.ri, selection.end.ri),
            bottom: Math.max(selection.start.ri, selection.end.ri),
            left: Math.min(selection.start.ci, selection.end.ci),
            right: Math.max(selection.start.ci, selection.end.ci),
        };
    }, [selection]);

    const isCellSelected = useCallback(
        (ri: number, ci: number) => {
            const r = getRange();
            if (!r) return false;
            return ri >= r.top && ri <= r.bottom && ci >= r.left && ci <= r.right;
        },
        [getRange]
    );

    return { getRange, isCellSelected };
};
