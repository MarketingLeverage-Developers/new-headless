import React from 'react';
import { useTableContext } from '../../Table';

// 그룹 헤더 행
export const GroupHeader: React.FC = () => {
    const { state, data } = useTableContext();
    if (!state.groupColumnRow.columns.length) return null;
    return (
        <tr>
            {state.groupColumnRow.columns.map((gc, gi) => (
                <th key={`g-${gc.key}-${gi}`} colSpan={gc.colSpan}>
                    {gc.render(gc.key, data)}
                </th>
            ))}
        </tr>
    );
};
