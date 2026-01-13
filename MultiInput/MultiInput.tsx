import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Trigger from './components/Trigger/Trigger';
import Item from './components/Item/Item';

type MultiInputContextType = {
    inputValues: string[];
    setInputValue: (idx: number, value: string) => void;
    addInput: () => void;
    removeInput: (idx: number) => void;
    combinedValue: string;
    count: number;
    canAdd: boolean;
    canRemove: boolean;
};

const MultiInputContext = createContext<MultiInputContextType | null>(null);

export const useMultiInput = () => {
    const context = useContext(MultiInputContext);
    if (!context) {
        throw new Error('MultiInput 컴포넌트 내부에서 사용해야 합니다.');
    }
    return context;
};

type MultiInputProps = {
    children: React.ReactNode;
    value?: string;
    onChange?: (combinedValue: string) => void;
    separator?: string;
    minCount?: number;
    maxCount?: number;
};

type Compound = React.FC<MultiInputProps> & {
    Trigger: typeof Trigger;
    Item: typeof Item;
};

const MultiInput: Compound = ({ children, value, onChange, separator = ', ', minCount = 1, maxCount }) => {
    const parseValue = useCallback(
        (val?: string) => {
            if (!val) return Array(minCount).fill('');
            const parsed = val.split(separator).map((s) => s.trim());
            return parsed.length >= minCount ? parsed : [...parsed, ...Array(minCount - parsed.length).fill('')];
        },
        [minCount, separator]
    );

    const [inputValues, setInputValues] = useState<string[]>(() => parseValue(value));

    useEffect(() => {
        setInputValues(parseValue(value));
    }, [value, parseValue]);

    const updateAndNotify = useCallback(
        (newValues: string[]) => {
            setInputValues(newValues);
            const combined = newValues.filter((v) => v.trim() !== '').join(separator);
            onChange?.(combined);
        },
        [onChange, separator]
    );

    const setInputValue = useCallback(
        (idx: number, newValue: string) => {
            updateAndNotify(inputValues.map((v, i) => (i === idx ? newValue : v)));
        },
        [inputValues, updateAndNotify]
    );

    const addInput = useCallback(() => {
        if (maxCount && inputValues.length >= maxCount) return;
        updateAndNotify([...inputValues, '']);
    }, [inputValues, updateAndNotify, maxCount]);

    const removeInput = useCallback(
        (idx: number) => {
            if (inputValues.length <= minCount) return;
            updateAndNotify(inputValues.filter((_, i) => i !== idx));
        },
        [inputValues, updateAndNotify, minCount]
    );

    const combinedValue = useMemo(
        () => inputValues.filter((v) => v.trim() !== '').join(separator),
        [inputValues, separator]
    );
    const canAdd = !maxCount || inputValues.length < maxCount;
    const canRemove = inputValues.length > minCount;

    const contextValue = useMemo(
        () => ({
            inputValues,
            setInputValue,
            addInput,
            removeInput,
            combinedValue,
            count: inputValues.length,
            canAdd,
            canRemove,
        }),
        [inputValues, setInputValue, addInput, removeInput, combinedValue, canAdd, canRemove]
    );

    return <MultiInputContext.Provider value={contextValue}>{children}</MultiInputContext.Provider>;
};

MultiInput.Trigger = Trigger;
MultiInput.Item = Item;

export default MultiInput;
