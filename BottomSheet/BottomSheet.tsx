import React, { createContext, useContext, useMemo, useState, useId, useCallback } from 'react';
import { Content, Trigger } from './components';

type SetOpen = (next: boolean | ((prev: boolean) => boolean)) => void;

type Ctx = {
    open: boolean;
    setOpen: SetOpen;
    id: string;
};
const BottomSheetCtx = createContext<Ctx | null>(null);
export const useBottomSheetCtx = () => {
    const ctx = useContext(BottomSheetCtx);
    if (!ctx) throw new Error('BottomSheet subcomponents must be used within <BottomSheet>');
    return ctx;
};

type BottomSheetProps = {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};
const BottomSheet = ({ children, open: openProp, onOpenChange }: BottomSheetProps) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const controlled = openProp !== undefined;
    const open = controlled ? !!openProp : uncontrolledOpen;

    const setOpen = useCallback<SetOpen>(
        (next) => {
            // next 계산 함수
            const compute = (prev: boolean) =>
                typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;

            if (controlled) {
                const nextVal = compute(open);
                onOpenChange?.(nextVal);
            } else {
                setUncontrolledOpen((prev) => {
                    const nextVal = compute(prev);
                    onOpenChange?.(nextVal);
                    return nextVal;
                });
            }
        },
        [controlled, open, onOpenChange]
    );

    const id = useId();
    const value = useMemo<Ctx>(() => ({ open, setOpen, id }), [open, setOpen, id]);
    return <BottomSheetCtx.Provider value={value}>{children}</BottomSheetCtx.Provider>;
};

export default BottomSheet;

BottomSheet.Trigger = Trigger;
BottomSheet.Content = Content;
