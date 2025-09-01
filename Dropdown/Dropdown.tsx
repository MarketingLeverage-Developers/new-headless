import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import Trigger from './components/Trigger/Trigger';
import Content from './components/Content/Content';

type DropdownContextType = {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    anchorRef: React.MutableRefObject<HTMLDivElement | null>;
    menuId: string;
    lastFocusedEl: HTMLElement | null;
    setLastFocusedEl: (el: HTMLElement | null) => void;
};

const DropdownContext = createContext<DropdownContextType>({
    isOpen: false,
    open: () => {},
    close: () => {},
    toggle: () => {},
    anchorRef: { current: null } as React.MutableRefObject<HTMLDivElement | null>,
    menuId: '',
    lastFocusedEl: null,
    setLastFocusedEl: () => {},
});

export const useDropdown = () => useContext(DropdownContext);

type Compound = React.FC<{ children: React.ReactNode }> & {
    Trigger: typeof Trigger;
    Content: typeof Content;
};

const Dropdown: Compound = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const [lastFocusedEl, setLastFocusedEl] = useState<HTMLElement | null>(null);
    const uid = useId();
    const menuId = useMemo(() => `dropdown-${uid.replace(/[:]/g, '')}`, [uid]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((v) => !v), []);

    const value = useMemo(
        () => ({ isOpen, open, close, toggle, anchorRef, menuId, lastFocusedEl, setLastFocusedEl }),
        [isOpen, open, close, toggle, menuId, lastFocusedEl]
    );

    return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>;
};

Dropdown.Trigger = Trigger;
Dropdown.Content = Content;

export default Dropdown;
