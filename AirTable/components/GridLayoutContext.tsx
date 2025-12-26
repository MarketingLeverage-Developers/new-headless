import React, { createContext, useContext } from 'react';
import type { DragGhost, SelectionState } from '../AirTable';

export type GridLayout<T> = {
    data: T[];
    gridTemplateColumns: string;
    effectiveOrder: string[];
    headerScrollLeft: number;
    draggingKey: string | null;

    ghost: DragGhost | null;
    setGhost: React.Dispatch<React.SetStateAction<DragGhost | null>>;

    selection: SelectionState;
    isCellSelected: (ri: number, ci: number) => boolean;
    beginSelect: (pos: { ri: number; ci: number }) => void;
    updateSelect: (pos: { ri: number; ci: number }) => void;
    endSelect: () => void;

    getShiftStyle: (colKey: string) => React.CSSProperties;
    handleHeaderMouseDown: (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
    handleResizeMouseDown: (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
};

const GridLayoutContext = createContext<GridLayout<unknown> | null>(null);

export const GridLayoutProvider = <T,>({ value, children }: { value: GridLayout<T>; children: React.ReactNode }) => (
    <GridLayoutContext.Provider value={value as GridLayout<unknown>}>{children}</GridLayoutContext.Provider>
);

export const useGridLayout = <T,>() => {
    const ctx = useContext(GridLayoutContext);
    if (!ctx) throw new Error('useGridLayout must be used inside GridLayoutProvider');
    return ctx as GridLayout<T>;
};
