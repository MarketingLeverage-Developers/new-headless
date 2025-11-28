import React, { useState } from 'react';
import { RowDetailsProvider, useDetailsRenderer, useTableContext } from '../../Table';
import { Row } from '../Row/Row';
import { Cell } from '../Cell/Cell';

// 행 + 디테일 행을 렌더링하는 기본 BodyRows
export const BodyRows: React.FC = () => {
    const { state } = useTableContext();
    const renderDetails = useDetailsRenderer();
    const [openRow, setOpenRow] = useState<string | null>(null);

    const setToggle = (rowKey: string) => () => setOpenRow((prev) => (prev === rowKey ? null : rowKey));

    return (
        <>
            {state.rows.map((row, ri) => {
                const opened = openRow === row.key;

                return (
                    <React.Fragment key={row.key}>
                        {/* 행 컨텍스트 주입: 이 안의 셀들에서 <Table.Toggle/> 사용 가능 */}
                        <RowDetailsProvider value={{ row, ri, opened, toggle: setToggle(row.key) }}>
                            <Row>
                                {row.cells.map((cell, ci) => (
                                    <Cell key={`cell-${cell.key}-${ci}`}>{cell.render(row.item, ri)}</Cell>
                                ))}
                            </Row>

                            {/* hiddenCells 기반이 아니라, 단순히 토글 여부만으로 디테일 행 렌더링 */}
                            {opened && (
                                <Row>
                                    <Cell colSpan={state.columnRow.columns.length}>
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
