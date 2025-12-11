// TableX/components/View/View.tsx
import React from 'react';
import { useTableContext } from '../../Table';

type TableViewProps = React.HTMLAttributes<HTMLTableElement>;

const TableView = React.forwardRef<HTMLTableElement, TableViewProps>(({ style, ...rest }, ref) => {
    const { state } = useTableContext<any>();

    const totalTableWidth = state.columnRow.columns.reduce((sum, col) => sum + col.width, 0);

    return (
        <table
            {...rest}
            ref={ref}
            style={{
                tableLayout: 'fixed',
                // ✅ 화면(컨테이너) 가로를 항상 100% 채우기
                width: '100%',
                // ✅ 컬럼 전체 너비보다 더 좁아지지는 않게 보장
                minWidth: `${totalTableWidth}px`,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                ...style,
            }}
        />
    );
});

TableView.displayName = 'TableView';

export default TableView;
