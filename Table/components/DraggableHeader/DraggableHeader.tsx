import React, { type ReactNode } from 'react';
import { useTableContext } from '../../Table';

type DraggableHeaderProps = {
    columnKey: string;
    children: ReactNode;
};

const DraggableHeader: React.FC<DraggableHeaderProps> = ({ columnKey, children }) => {
    const { state } = useTableContext<unknown>();
    const { reorderColumn } = state;

    const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', columnKey);
    };

    const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        const fromKey = e.dataTransfer.getData('text/plain');
        if (!fromKey || fromKey === columnKey) return;

        reorderColumn(fromKey, columnKey);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
                cursor: 'grab',
            }}
        >
            {children}
        </div>
    );
};

export default DraggableHeader;
