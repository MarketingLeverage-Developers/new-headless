import React from 'react';
import { useImageUploader } from '../../ImageUploader';
import styles from '../../ImageUploader.module.scss';

// Select.Display처럼 바깥에서 render-prop로 제어 버튼 구성
type Props = {
    children?: React.ReactNode | ((api: { open: () => void; clear: () => void; count: number }) => React.ReactNode);
};

export const Controls: React.FC<Props> = ({ children }) => {
    const { openFileDialog, clear, changeImageUploaderValue } = useImageUploader();
    const content =
        typeof children === 'function'
            ? children({ open: openFileDialog, clear, count: changeImageUploaderValue.length })
            : children;

    return <div className={styles.Controls}>{content}</div>;
};
