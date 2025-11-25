import React from 'react';
import { useDropdown } from '../../Dropdown';

export type TriggerProps = React.ButtonHTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

const Trigger: React.FC<TriggerProps> = ({ children, ...props }) => {
    const { isOpen, toggle, anchorRef, menuId, setLastFocusedEl } = useDropdown();

    const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (props.disabled) return;

        props.onClick?.(e);
        if (!isOpen) setLastFocusedEl(document.activeElement as HTMLElement | null);
        toggle();
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (props.disabled) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) setLastFocusedEl(document.activeElement as HTMLElement | null);
            toggle();
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) setLastFocusedEl(document.activeElement as HTMLElement | null);
            toggle();
        }
    };

    return (
        <div
            {...props}
            ref={anchorRef}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={menuId}
        >
            {children}
        </div>
    );
};

export default Trigger;
