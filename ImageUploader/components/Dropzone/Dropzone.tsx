import React from 'react';
import { useImageUploader } from '../../ImageUploader';
import styles from '../../ImageUploader.module.scss';

type Props = {
    children?: React.ReactNode | ((state: { dragging: boolean; open: () => void }) => React.ReactNode);
};

export const Dropzone: React.FC<Props> = ({ children }) => {
    const { dragging, openFileDialog } = useImageUploader();
    const content = typeof children === 'function' ? children({ dragging, open: openFileDialog }) : children;

    return (
        <div
            className={styles.Dropzone}
            role="button"
            tabIndex={0}
            data-dragging={dragging ? 'true' : 'false'}
            onClick={openFileDialog}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openFileDialog();
            }}
        >
            {content}
        </div>
    );
};

export default Dropzone;
