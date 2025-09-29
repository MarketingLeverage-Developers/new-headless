import { useAccordion } from '../Accordion';

type ButtonProps = React.HTMLAttributes<HTMLDivElement> & {
    onBeforeToggle?: (current: boolean) => boolean | void;
};

export const Button = ({ children, onClick, onBeforeToggle, ...props }: ButtonProps) => {
    const { accordionValue, toggleAccordion } = useAccordion();

    const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        const shouldBlock = onBeforeToggle?.(accordionValue);
        if (shouldBlock) return;
        toggleAccordion();
    };

    return (
        <div role="button" style={{ border: 'none' }} {...props} onClick={handleClick}>
            {children}
        </div>
    );
};
