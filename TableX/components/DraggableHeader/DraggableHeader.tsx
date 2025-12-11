import React, { useRef, useState } from 'react';
import { useTableContext } from '@/shared/headless/TableX/Table';

type DraggableHeaderProps = {
    columnKey: string;
    children: React.ReactNode;
};

const DraggableHeader: React.FC<DraggableHeaderProps> = ({ columnKey, children }) => {
    const { state } = useTableContext<any>();
    const { columnOrder, reorderColumn } = state;

    const [isDragging, setIsDragging] = useState(false);
    const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);

    const rootRef = useRef<HTMLDivElement | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', columnKey);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
        setDropPosition(null);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setDropPosition(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!rootRef.current) return;

        const rect = rootRef.current.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        // 좌/우 절반 기준으로 "여기로 들어간다" 방향 표시
        if (e.clientX < midX) {
            setDropPosition('left');
        } else {
            setDropPosition('right');
        }
    };

    // 🔥 핵심 수정: 떠나는 순간엔 그냥 무조건 인디케이터 OFF
    const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>) => {
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        const fromKey = e.dataTransfer.getData('text/plain');
        if (!fromKey || fromKey === columnKey) {
            setDropPosition(null);
            return;
        }

        const fromIndex = columnOrder.indexOf(fromKey);
        const toIndex = columnOrder.indexOf(columnKey);
        if (fromIndex === -1 || toIndex === -1) {
            setDropPosition(null);
            return;
        }

        let targetKey = columnKey;

        // 오른쪽 절반에 드랍했다면 → 이 컬럼 "뒤"로 보내기
        if (dropPosition === 'right') {
            const nextKey = columnOrder[toIndex + 1];
            if (nextKey) {
                targetKey = nextKey;
            }
        }

        reorderColumn(fromKey, targetKey);
        setDropPosition(null);
        setIsDragging(false);
    };

    return (
        <div
            ref={rootRef}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                height: '100%',
                paddingInline: 8,
                boxSizing: 'border-box',
                cursor: 'move',
                userSelect: 'none',
                opacity: isDragging ? 0.6 : 1,
                transition: 'opacity 120ms ease-out',
            }}
        >
            {/* 실제 헤더 내용 */}
            {children}

            {/* 🎯 왼쪽 세로 인디케이터 */}
            {dropPosition === 'left' && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: 4,
                        height: '100%',
                        background: 'var(--Primary5, #2684ff)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* 🎯 오른쪽 세로 인디케이터 */}
            {dropPosition === 'right' && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: 4,
                        height: '100%',
                        background: 'var(--Primary5, #2684ff)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                    }}
                />
            )}
        </div>
    );
};

export default DraggableHeader;
