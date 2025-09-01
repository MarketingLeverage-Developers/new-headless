import React from 'react';
import { useModal } from '../../Modal';

type TriggerProps = React.HTMLAttributes<HTMLSpanElement> & {
    children: React.ReactNode;
};

export const Trigger = ({ ...props }: TriggerProps) => {
    const { openModal } = useModal();

    const handleTriggerClick = () => {
        openModal();
    };

    return <span {...props} onClick={handleTriggerClick} />;
};
