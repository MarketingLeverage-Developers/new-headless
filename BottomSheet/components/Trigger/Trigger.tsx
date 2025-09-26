import React from 'react';
import { useBottomSheetCtx } from '../../BottomSheet';
import BaseButton from '@/shared/primitives/BaseButton/BaseButton';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';
import { IoMdOptions } from 'react-icons/io';

type TriggerProps = {
    children?: React.ReactNode;
};

export const Trigger = ({ children }: TriggerProps) => {
    const { setOpen } = useBottomSheetCtx();

    return (
        <BaseButton
            width={'fit-content'}
            bgColor={getThemeColor('Gray6')}
            padding={{ x: 12, y: 9 }}
            onClick={() => setOpen(true)}
            radius={6}
        >
            {children ? children : <IoMdOptions color={getThemeColor('Gray1')} />}
        </BaseButton>
    );
};
