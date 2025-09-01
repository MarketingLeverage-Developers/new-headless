import React, { useState } from 'react';
import { Row } from '../Row/Row';
import { Cell } from '../Cell/Cell';
import { RowDetailsProvider, useDetailsRenderer, useTableContext } from '../../AccordionTable';

export const BodyRows: React.FC = () => {
    const { state } = useTableContext();
    const renderDetails = useDetailsRenderer();
    const [openRow, setOpenRow] = useState<string | null>(null);
    const setToggle = (rowKey: string) => () => setOpenRow((prev) => (prev === rowKey ? null : rowKey));

    return (
        <>
            {state.rows.map((row, ri) => {
                const node = renderDetails({ row, ri, state });
                const hasHidden = !!node;
                const opened = openRow === row.key;

                return (
                    <React.Fragment key={row.key}>
                        <RowDetailsProvider value={{ row, ri, opened, hasHidden, toggle: setToggle(row.key) }}>
                            <Row>
                                {row.cells.map((cell, ci) => (
                                    <Cell key={`cell-${cell.key}-${ci}`}>{cell.render(row.item, ri)}</Cell>
                                ))}
                            </Row>
                            {hasHidden && opened && (
                                <Row>
                                    <Cell colSpan={state.columnRow.columns.length}>{node}</Cell>
                                </Row>
                            )}
                        </RowDetailsProvider>
                    </React.Fragment>
                );
            })}
        </>
    );
};
