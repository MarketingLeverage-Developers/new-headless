import React from 'react';
import { useRowDetails } from '../../Table';

// 각 행의 디테일 열기/닫기 토글 버튼
export const Toggle: React.FC<{
    openLabel?: string;
    closedLabel?: string;
    // 과거 hiddenCells 기반 옵션 (지금은 더 이상 사용하지 않지만, 타입만 남겨서 하위 호환)
    hideIfNoHidden?: boolean;
}> = ({ openLabel = '접기', closedLabel = '열기' }) => {
    const { opened, toggle } = useRowDetails();
    return (
        <button type="button" onClick={toggle}>
            {opened ? openLabel : closedLabel}
        </button>
    );
};
