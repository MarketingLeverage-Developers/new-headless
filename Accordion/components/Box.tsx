type BoxProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

export const Box = ({ children, style, ...props }: BoxProps) => {
    const baseStyle: React.CSSProperties = { display: 'inline-block' };
    return (
        <div {...props} style={{ ...baseStyle, ...style }}>
            {children}
        </div>
    );
};
