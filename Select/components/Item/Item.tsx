// 파일: shared/headless/select/components/Item.tsx
// 목적: Headless Select의 개별 항목
// - 컨텍스트에서 changeSelectValue / isActive / selectValue 사용
// - React.memo + 커스텀 비교 함수 적용으로 부모 리렌더 시 불필요 렌더 스킵
// - 함수/컴포넌트는 전부 화살표 함수로 작성

import React from 'react';
import { useSelect } from '../../Select';

// HTMLButton의 기본 'value' 타입은 제거하고, 우리 string으로 다시 선언
export type SelectItemProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'value'> & {
    value: string;
    children?: React.ReactNode;
    onClick?: (value: string) => void;
    // ✅ 새 이름
};

// 베이스 컴포넌트 (메모 대상)
const Item: React.FC<SelectItemProps> = ({
    value,
    children,
    onClick, // 외부에서 추가로 onClick 쓰면 체이닝
    ...props
}) => {
    const { changeSelectValue, isActive, selectValue } = useSelect();

    // 클릭 시: 컨텍스트 변경 + 콜백 체이닝
    const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        changeSelectValue(value);
        onClick?.(value);
    };
    console.log('item', selectValue);

    return (
        <div {...props} onClick={handleClick} aria-pressed={isActive(value)}>
            {children}
        </div>
    );
};

export default Item;
