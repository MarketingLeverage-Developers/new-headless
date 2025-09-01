import React from 'react';
import { useTableContext } from '../../AccordionTable';

export const ColGroup: React.FC<React.HTMLAttributes<HTMLTableColElement>> = (props) => {
    const { state } = useTableContext();
    return (
        <colgroup>
            {state.columnRow.columns.map((_, i) => (
                <col key={`col-${i}`} style={state.getColStyle(i)} {...props} />
            ))}
        </colgroup>
    );
};
