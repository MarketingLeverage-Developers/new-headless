import React from 'react';
import { useFileUploader, type AddMode } from '../../FileUploader';
import styles from '../../FileUploader.module.scss';

type Props = {
    mode?: AddMode;
    children?: React.ReactNode | ((state: { dragging: boolean; open: () => void }) => React.ReactNode);
};

export const Dropzone: React.FC<Props> = ({ children, mode = { kind: 'any', accept: '*/*' } }) => {
    const { openFileDialog, addFiles } = useFileUploader();
    const [dragging, setDragging] = React.useState(false);

    const content =
        typeof children === 'function' ? children({ dragging, open: () => openFileDialog(mode) }) : children;

    return (
        <div
            className={styles.Dropzone}
            role="button"
            tabIndex={0}
            data-dragging={dragging ? 'true' : 'false'}
            onClick={() => openFileDialog(mode)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openFileDialog(mode);
            }}
            onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(true);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
            }}
            onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
                const files = e.dataTransfer?.files;
                if (files?.length) await addFiles(files, mode);
                e.dataTransfer?.clearData();
            }}
        >
            {content}
        </div>
    );
};

// export default Dropzone;
