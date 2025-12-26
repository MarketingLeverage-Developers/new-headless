import React from 'react';
import { useAirTableContext } from '../AirTable';

type BodyProps = {
    className?: string;
    rowClassName?: string;
    cellClassName?: string;
    selectedCellClassName?: string;
};

export const Body = <T,>({ className, rowClassName, cellClassName, selectedCellClassName }: BodyProps) => {
    const {
        props,
        scrollRef,
        tableAreaRef,
        state,
        baseOrder,
        gridTemplateColumns,
        getShiftStyle,
        setSelection,
        isCellSelected,
    } = useAirTableContext<T>();

    const { getRowStyle, detailRenderer } = props;
    const { rows, drag } = state;

    const beginSelect = (ri: number, ci: number) => {
        setSelection({ start: { ri, ci }, end: { ri, ci }, isSelecting: true });
    };

    const updateSelect = (ri: number, ci: number) => {
        setSelection((prev) => {
            if (!prev.isSelecting) return prev;
            return { ...prev, end: { ri, ci } };
        });
    };

    return (
        <div ref={scrollRef} className={className}>
            <div ref={tableAreaRef} style={{ position: 'relative' }}>
                <div>
                    {rows.map((row, ri) => {
                        const rowStyle = getRowStyle?.(row.item, ri) ?? {};
                        const rowKey = row.key;

                        return (
                            <div
                                key={rowKey}
                                className={rowClassName}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns,
                                    ...rowStyle,
                                }}
                            >
                                {baseOrder.map((colKey, ci) => {
                                    const cell = row.cells.find((c) => c.key === colKey);
                                    if (!cell) return null;

                                    const selected = isCellSelected(ri, ci);

                                    return (
                                        <div
                                            key={`c-${rowKey}-${colKey}`}
                                            id={`__cell_${row.key}_${colKey}`}
                                            className={[
                                                cellClassName ?? '',
                                                selected ? selectedCellClassName ?? '' : '',
                                            ].join(' ')}
                                            onMouseDown={() => {
                                                if (drag.draggingKey) return;
                                                beginSelect(ri, ci);
                                            }}
                                            onMouseEnter={() => {
                                                if (drag.draggingKey) return;
                                                updateSelect(ri, ci);
                                            }}
                                            style={{
                                                ...getShiftStyle(colKey),
                                            }}
                                        >
                                            {cell.render(row.item, ri)}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {detailRenderer && <div style={{ display: 'none' }} />}
        </div>
    );
};
