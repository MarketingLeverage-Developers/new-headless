import React from 'react';
import { useToggle } from '../../Toggle';

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    onTriggerClick?: (value: boolean) => void;
};

const Trigger: React.FC<TriggerProps> = ({ children, onTriggerClick, ...props }) => {
    const { changeToggle } = useToggle();

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
        const next = changeToggle();
        onTriggerClick?.(next);
        props.onClick?.(e);
    };

    return (
        <button {...props} onClick={handleClick}>
            {children}
        </button>
    );
};

export default Trigger;
