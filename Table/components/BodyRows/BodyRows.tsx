import React, { useState } from 'react';
import { RowDetailsProvider, useDetailsRenderer, useTableContext } from '../../Table';
import { Row } from '../Row/Row';
import { Cell } from '../Cell/Cell';

export const BodyRows: React.FC = () => {
    const { state } = useTableContext();
    const renderDetails = useDetailsRenderer();
    const [openRow, setOpenRow] = useState<string | null>(null);
    const setToggle = (rowKey: string) => () => setOpenRow((prev) => (prev === rowKey ? null : rowKey));

    return (
        <>
            {state.rows.map((row, ri) => {
                const hasHidden = row.hiddenCells.length > 0;
                const opened = openRow === row.key;

                return (
                    <React.Fragment key={row.key}>
                        {/* 행 컨텍스트 주입: 이 안의 셀들에서 <Table.Toggle/> 사용 가능 */}
                        <RowDetailsProvider value={{ row, ri, opened, hasHidden, toggle: setToggle(row.key) }}>
                            <Row>
                                {row.cells.map((cell, ci) => (
                                    <Cell key={`cell-${cell.key}-${ci}`}>{cell.render(row.item, ri)}</Cell>
                                ))}
                                {/* ✅ 더 이상 여기서 토글용 셀을 추가하지 않음 */}
                            </Row>

                            {hasHidden && opened && (
                                <Row>
                                    <Cell
                                        colSpan={state.columnRow.columns.length /* 가변: 토글 셀 제거로 +1 필요 없음 */}
                                    >
                                        {renderDetails({ row, ri, state })}
                                    </Cell>
                                </Row>
                            )}
                        </RowDetailsProvider>
                    </React.Fragment>
                );
            })}
        </>
    );
};
