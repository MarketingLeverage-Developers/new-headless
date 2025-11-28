// Table.View.tsx
import React from 'react';
import { useTableContext } from '../../Table';

type TableViewProps = React.HTMLAttributes<HTMLTableElement>;

const TableView = React.forwardRef<HTMLTableElement, TableViewProps>(({ style, ...rest }, ref) => {
    // ✅ Table 컨텍스트에서 state 가져오기
    const { state } = useTableContext<any>();

    // ✅ columnRow 기준으로 total width 계산
    const totalTableWidth = state.columnRow.columns.reduce((sum, col) => sum + col.width, 0);

    return (
        <table
            {...rest}
            ref={ref}
            style={{
                tableLayout: 'fixed',
                width: `${totalTableWidth}px`,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                ...style,
            }}
        />
    );
});

TableView.displayName = 'TableView';

export default TableView;
