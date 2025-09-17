import React from 'react';
import { useBottomSheetCtx } from '../../BottomSheet';
import BaseButton from '@/shared/primitives/BaseButton/BaseButton';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';
import { IoMdOptions } from 'react-icons/io';

export const Trigger = () => {
    const { setOpen } = useBottomSheetCtx();

    return (
        <BaseButton
            width={'fit-content'}
            bgColor={getThemeColor('Gray6')}
            padding={{ x: 12, y: 9 }}
            onClick={() => setOpen(true)}
            radius={6}
        >
            <IoMdOptions color={getThemeColor('Gray1')} />
        </BaseButton>
    );
};
