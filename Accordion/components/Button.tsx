import { useAccordion } from '../Accordion';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    onBeforeToggle?: (current: boolean) => boolean | void;
};

export const Button = ({ children, onClick, onBeforeToggle, ...props }: ButtonProps) => {
    const { accordionValue, toggleAccordion } = useAccordion();

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        const shouldBlock = onBeforeToggle?.(accordionValue);
        if (shouldBlock) return;
        toggleAccordion();
    };

    return (
        <button style={{ border: 'none' }} {...props} onClick={handleClick}>
            {children}
        </button>
    );
};
