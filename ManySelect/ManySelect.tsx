import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Item } from './components';

export type ManySelectValue = string[];

type ManySelectContextType = {
    manySelectValue: ManySelectValue;
    changeManySelectValue: (next: ManySelectValue) => void;
    toggleManySelectValue: (v: string) => ManySelectValue;
    isChecked: (v: string) => boolean;
};

const ManySelectContext = createContext<ManySelectContextType>({
    manySelectValue: [],
    changeManySelectValue: () => {},
    toggleManySelectValue: () => [],
    isChecked: () => false,
});

type ManySelectProps = {
    children: ReactNode;
    defaultValue?: ManySelectValue;
    value?: ManySelectValue;
    onChange?: (next: ManySelectValue) => void;
};

type ManySelectComponent = React.FC<ManySelectProps> & { Item: typeof Item };

const uniq = (arr: ManySelectValue) => Array.from(new Set(arr));

const ManySelect = (({ children, defaultValue = [], value, onChange }: ManySelectProps) => {
    const [internalValue, setInternalValue] = useState<ManySelectValue>(uniq(defaultValue));
    const isControlled = value !== undefined;
    const manySelectValue = (isControlled ? uniq((value as ManySelectValue) ?? []) : internalValue) as ManySelectValue;

    const changeManySelectValue = (next: ManySelectValue) => {
        const u = uniq(next);
        if (isControlled) {
            onChange?.(u);
        } else {
            setInternalValue(u);
            onChange?.(u);
        }
    };

    const isChecked = (v: string) => manySelectValue.includes(v);

    const toggleManySelectValue = (v: string) => {
        const next = isChecked(v) ? manySelectValue.filter((x) => x !== v) : uniq([...manySelectValue, v]);
        changeManySelectValue(next);
        return next;
    };

    useEffect(() => {
        console.log('manySelectValue', manySelectValue);
    }, [manySelectValue]);

    return (
        <ManySelectContext.Provider
            value={{ manySelectValue, changeManySelectValue, toggleManySelectValue, isChecked }}
        >
            {children}
        </ManySelectContext.Provider>
    );
}) as ManySelectComponent;

ManySelect.Item = Item;

export const useManySelect = () => useContext(ManySelectContext);
export default ManySelect;
