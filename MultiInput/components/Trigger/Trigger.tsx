import type React from 'react';
import { useMultiInput } from '../../MultiInput';

export type MultiInputTriggerProps = {
    children: React.ReactNode | ((props: { addInput: () => void; disabled: boolean }) => React.ReactNode);
};

/**
 * MultiInput.Trigger - 입력 필드를 추가하는 트리거 영역
 * children에 render props 패턴 사용 가능
 */
const Trigger = ({ children }: MultiInputTriggerProps) => {
    const { addInput, canAdd } = useMultiInput();

    if (typeof children === 'function') {
        return <>{children({ addInput, disabled: !canAdd })}</>;
    }

    return (
        <div onClick={canAdd ? addInput : undefined} style={{ cursor: canAdd ? 'pointer' : 'not-allowed' }}>
            {children}
        </div>
    );
};

export default Trigger;
