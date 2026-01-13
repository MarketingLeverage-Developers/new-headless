import type React from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import Trigger from './components/Trigger/Trigger';
import Item from './components/Item/Item';

// Context 타입 정의
type MultiInputContextType = {
    /** 현재 입력값 배열 */
    inputValues: string[];
    /** 특정 인덱스의 입력값 변경 */
    setInputValue: (idx: number, value: string) => void;
    /** 새 입력 필드 추가 */
    addInput: () => void;
    /** 특정 인덱스의 입력 필드 제거 */
    removeInput: (idx: number) => void;
    /** 모든 입력값을 separator로 합친 문자열 */
    combinedValue: string;
    /** 입력 필드 개수 */
    count: number;
    /** 추가 가능 여부 */
    canAdd: boolean;
    /** 제거 가능 여부 */
    canRemove: boolean;
};

const MultiInputContext = createContext<MultiInputContextType | null>(null);

// Context Hook
export const useMultiInput = () => {
    const context = useContext(MultiInputContext);
    if (!context) {
        throw new Error('MultiInput 컴포넌트 내부에서 사용해야 합니다.');
    }
    return context;
};

// Root 컴포넌트 Props
type MultiInputProps = {
    children: React.ReactNode;
    /** 초기값 또는 제어 컴포넌트용 값 (separator로 구분된 문자열) */
    value?: string;
    /** 값 변경 시 콜백 (separator로 합쳐진 문자열 반환) */
    onChange?: (combinedValue: string) => void;
    /** 값 구분자 (기본값: ", ") */
    separator?: string;
    /** 최소 입력 필드 개수 (기본값: 1) */
    minCount?: number;
    /** 최대 입력 필드 개수 */
    maxCount?: number;
};

// Compound 타입 정의
type Compound = React.FC<MultiInputProps> & {
    Trigger: typeof Trigger;
    Item: typeof Item;
};

const MultiInput: Compound = ({ children, value, onChange, separator = ', ', minCount = 1, maxCount }) => {
    // value가 있으면 파싱, 없으면 minCount만큼 빈 배열로 시작
    const parseValue = (val?: string) => {
        if (!val) return Array(minCount).fill('');
        const parsed = val.split(separator).map((s) => s.trim());
        return parsed.length >= minCount ? parsed : [...parsed, ...Array(minCount - parsed.length).fill('')];
    };

    const [inputValues, setInputValues] = useState<string[]>(() => parseValue(value));

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
            const newValues = [...inputValues];
            newValues[idx] = newValue;
            updateAndNotify(newValues);
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
            const newValues = inputValues.filter((_, i) => i !== idx);
            updateAndNotify(newValues);
        },
        [inputValues, updateAndNotify, minCount]
    );

    const combinedValue = inputValues.filter((v) => v.trim() !== '').join(separator);
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
