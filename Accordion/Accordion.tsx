import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Box } from './components/Box';
import { Button } from './components/Button';
import { Visible } from './components/Visible';
import { Hidden } from './components/Hidden';

type AccordionContextType = {
    accordionValue: boolean;
    setAccordionValue: (next: boolean) => void;
    toggleAccordion: () => void;
    showAccordion: () => void;
    hideAccordion: () => void;
};

const AccordionContext = createContext<AccordionContextType | null>(null);

type AccordionProps = {
    children: React.ReactNode;
    value?: boolean;
    defaultValue?: boolean;
    onValueChange?: (next: boolean) => void;
};

export const Accordion = ({ children, value, defaultValue, onValueChange }: AccordionProps) => {
    const isControlled = typeof value === 'boolean';
    const [internal, setInternal] = useState<boolean>(defaultValue ?? false);

    const accordionValue = isControlled ? (value as boolean) : internal;

    const setAccordionValue = useCallback(
        (next: boolean) => {
            if (!isControlled) setInternal(next);
            onValueChange?.(next);
        },
        [isControlled, onValueChange]
    );

    const toggleAccordion = useCallback(() => setAccordionValue(!accordionValue), [accordionValue, setAccordionValue]);
    const showAccordion = useCallback(() => setAccordionValue(true), [setAccordionValue]);
    const hideAccordion = useCallback(() => setAccordionValue(false), [setAccordionValue]);

    const valueMemo = useMemo(
        () => ({ accordionValue, setAccordionValue, toggleAccordion, showAccordion, hideAccordion }),
        [accordionValue, setAccordionValue, toggleAccordion, showAccordion, hideAccordion]
    );

    return <AccordionContext.Provider value={valueMemo}>{children}</AccordionContext.Provider>;
};

export const useAccordion = () => {
    const ctx = useContext(AccordionContext);
    if (!ctx) throw new Error('useAccordion must be used within <Accordion>');
    return ctx;
};

Accordion.Box = Box;
Accordion.Button = Button;
Accordion.Visible = Visible;
Accordion.Hidden = Hidden;
