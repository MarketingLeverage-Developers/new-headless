// 파일: shared/headless/select/Select.tsx
// 목적: Headless Select 컨텍스트 (가장 단순한 단일 컴포넌트 버전)
// - 컨트롤드(value, onChange) / 언컨트롤드(defaultValue) 지원
// - useCallback/useMemo 없이도 정상 동작
// - 정적 프로퍼티(Item) 부착

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import Item from './components/Item/Item';
import { Display } from './components';

type SelectContextType = {
    selectValue: string; // 현재 선택 값
    changeSelectValue: (value: string) => void; // 값 변경 API
    isActive: (value: string) => boolean; // 활성 여부
};

const SelectContext = createContext<SelectContextType>({
    selectValue: '',
    changeSelectValue: () => {},
    isActive: () => false,
});

type SelectProps = {
    children: ReactNode;
    defaultValue?: string; // 언컨트롤드 초기값
    value?: string; // 컨트롤드 값
    onChange?: (value: string) => void; // 변경 콜백
};

// Select 단일 컴포넌트 (Base 분리 없이 바로 정의)
type SelectComponent = React.FC<SelectProps> & { Item: typeof Item; Display: typeof Display };

const Select = (({ children, defaultValue = '', value, onChange }: SelectProps) => {
    // 언컨트롤드 내부 상태
    const [internalValue, setInternalValue] = useState<string>(defaultValue);

    // 컨트롤드 여부
    const isControlled = value !== undefined;

    // 현재 값(컨트롤드면 외부 value, 아니면 내부 state)
    const currentValue = (isControlled ? value : internalValue) as string;

    // 값 변경 (메모화 적용)
    const changeSelectValue = useCallback(
        (next: string) => {
            if (isControlled) {
                onChange?.(next); // 외부 제어: 콜백만
            } else {
                setInternalValue(next); // 내부 제어: 상태 변경
                onChange?.(next); // 필요 시 외부 알림
            }
        },
        [isControlled, onChange]
    );

    // 활성 여부 (메모화 적용)
    const isActive = useCallback((v: string) => v === currentValue, [currentValue]);

    // Context value 메모화
    const contextValue = useMemo(
        () => ({
            selectValue: currentValue,
            changeSelectValue,
            isActive,
        }),
        [currentValue, changeSelectValue, isActive]
    );

    // Provider에 메모화된 객체 전달
    return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
}) as SelectComponent;

// 정적 프로퍼티 부착
Select.Item = Item;
Select.Display = Display;

// 훅
export const useSelect = () => useContext(SelectContext);
export const useTabGroup = useSelect; // 하위 호환

// 기본/이름 export
export { Select };
export default Select;
