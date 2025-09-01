import React, { createContext, useContext, useEffect, useState } from 'react';
import Trigger from './components/Trigger/Trigger';

type ToggleContextType = {
    toggleValue: boolean;
    changeToggle: () => boolean;
};

const ToggleContext = createContext<ToggleContextType>({
    toggleValue: false,
    changeToggle: () => false,
});

type ToggleProps = {
    children: React.ReactNode;
    defaultValue?: boolean;
    value?: boolean;
    onChange?: (next: boolean) => void;
};

type ToggleComponent = React.FC<ToggleProps> & { Trigger: typeof Trigger };

const Toggle = (({ children, defaultValue = false, value, onChange }: ToggleProps) => {
    const [internalValue, setInternalValue] = useState<boolean>(defaultValue);
    const isControlled = value !== undefined;
    const toggleValue = (isControlled ? (value as boolean) : internalValue) as boolean;

    const changeToggle = () => {
        const next = !toggleValue;
        if (isControlled) {
            onChange?.(next);
        } else {
            setInternalValue(next);
            onChange?.(next);
        }
        return next;
    };

    useEffect(() => {
        console.log('toggleValue', toggleValue);
    }, [toggleValue]);

    return <ToggleContext.Provider value={{ toggleValue, changeToggle }}>{children}</ToggleContext.Provider>;
}) as ToggleComponent;

Toggle.Trigger = Trigger;

export const useToggle = () => useContext(ToggleContext);
export default Toggle;
