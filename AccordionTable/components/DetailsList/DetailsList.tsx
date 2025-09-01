import React from 'react';

type DetailsListProps = React.HTMLAttributes<HTMLDivElement> & {
    labelWidth?: number;
};

export const DetailsList: React.FC<DetailsListProps> = ({ labelWidth = 160, style, ...rest }) => <div {...rest} />;
