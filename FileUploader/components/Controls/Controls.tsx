// shared/headless/FileUploader/components/Controls/Controls.tsx
import React from 'react';
import { useFileUploader } from '../../FileUploader';
import styles from '../../FileUploader.module.scss';
import type { AddMode } from '../../FileUploader';

type Props = {
    mode?: AddMode;
    children?: React.ReactNode | ((api: { open: () => void; clear: () => void; count: number }) => React.ReactNode);
};

export const Controls: React.FC<Props> = ({ children, mode = { kind: 'any', accept: '*/*' } }) => {
    const { openFileDialog, clear, fileUploaderValue } = useFileUploader();
    const content =
        typeof children === 'function'
            ? children({ open: () => openFileDialog(mode), clear, count: fileUploaderValue.length })
            : children;

    return <div className={styles.Controls}>{content}</div>;
};

export default Controls;
