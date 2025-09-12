type VisibleProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

export const Visible = ({ children, ...props }: VisibleProps) => <div {...props}>{children}</div>;
