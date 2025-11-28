type DetailsListProps = React.HTMLAttributes<HTMLDivElement> & {
    labelWidth?: number; // px
};

export const DetailsList: React.FC<DetailsListProps> = ({ labelWidth = 160, style, ...rest }) => <div {...rest} />;
