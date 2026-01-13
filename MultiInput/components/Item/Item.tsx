'use client';

import type React from 'react';
import { useMultiInput } from '../../MultiInput';

export type MultiInputItemProps = {
    index: number;
    children:
        | React.ReactNode
        | ((props: {
              value: string;
              onChange: (value: string) => void;
              onRemove: () => void;
              canRemove: boolean;
          }) => React.ReactNode);
};

/**
 * MultiInput.Item - 개별 입력 필드 래퍼
 * children에 render props 패턴 사용 가능
 */
const Item = ({ index, children }: MultiInputItemProps) => {
    const { inputValues, setInputValue, removeInput, canRemove } = useMultiInput();

    const value = inputValues[index] ?? '';
    const onChange = (newValue: string) => setInputValue(index, newValue);
    const onRemove = () => removeInput(index);

    if (typeof children === 'function') {
        return <>{children({ value, onChange, onRemove, canRemove })}</>;
    }

    return <>{children}</>;
};

export default Item;
