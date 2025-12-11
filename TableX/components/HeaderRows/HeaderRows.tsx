// @/shared/headless/Table/components/HeaderRows/HeaderRows.tsx
// 헤더 행(tr) + columns 기반 헤더 셀 렌더링 + 컬럼 리사이즈
import React from 'react';
import { useTableContext } from '../../Table';
import { Row as DefaultRow } from '../Row/Row';
import { Th as DefaultTh } from '../Th/Th';
import type { CSSLength } from '@/shared/types';

type HeaderRowsProps = {
    height?: CSSLength;
    RowComponent?: React.ComponentType<React.HTMLAttributes<HTMLTableRowElement>>;
    ThComponent?: React.ComponentType<React.ThHTMLAttributes<HTMLTableCellElement>>;
} & React.HTMLAttributes<HTMLTableRowElement>;

export const HeaderRows: React.FC<HeaderRowsProps> = ({ height, RowComponent, ThComponent, style, ...rest }) => {
    const { state, data } = useTableContext();

    const RowTag = RowComponent ?? DefaultRow;
    const ThTag = ThComponent ?? DefaultTh;

    // ✅ key 기반 리사이즈
    const handleMouseDown = (colKey: string) => (event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const currentCol = state.columnRow.columns.find((c) => c.key === colKey);
        const startWidth = currentCol?.width ?? 0;
        const startX = event.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const nextWidth = startWidth + deltaX;
            state.resizeColumn(colKey, nextWidth);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const rowStyle: React.CSSProperties = {
        ...(height ? { height } : {}),
        ...style,
    };

    return (
        <RowTag {...rest} style={rowStyle}>
            {state.columnRow.columns.map((col) => (
                <ThTag
                    key={`c-${col.key}`}
                    style={{
                        ...state.getColStyle(col.key),
                        position: 'relative',
                    }}
                >
                    {col.render(col.key, data)}

                    {/* 오른쪽 리사이즈 핸들 영역 - disableColumnInteractions가 false일 때만 렌더링 */}
                    {!state.disableColumnInteractions && (
                        <span
                            onMouseDown={handleMouseDown(col.key)}
                            style={{
                                position: 'absolute',
                                top: 4,
                                right: -15, // 터치 영역 확보를 위해 우측으로 이동
                                bottom: 4,
                                width: 30, // 8 -> 30 (모바일 터치 용이성)
                                zIndex: 10,
                                cursor: 'col-resize',
                                userSelect: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {/* 실제 눈에 보이는 세로 막대 */}
                            <span
                                style={{
                                    width: 1,
                                    height: '60%',
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(0,0,0,0.15)',
                                }}
                            />
                        </span>
                    )}
                </ThTag>
            ))}
        </RowTag>
    );
};
