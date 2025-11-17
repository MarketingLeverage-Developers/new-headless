import React from 'react';
import { useTableContext } from '../../Table';
import { Row } from '../Row/Row';
import { Th } from '../Th/Th';

// 실제 컬럼 헤더 행
export const HeaderRows: React.FC = () => {
    const { state, data } = useTableContext();
    return (
        <Row>
            {state.columnRow.columns.map((col, i) => (
                <Th key={`c-${col.key}-${i}`} style={state.getColStyle(i)}>
                    {col.render(col.key, data)}
                </Th>
            ))}
        </Row>
    );
};
