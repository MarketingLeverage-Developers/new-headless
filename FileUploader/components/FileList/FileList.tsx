// shared/headless/FileUploader/components/FileList/FileList.tsx
import React, { type HTMLAttributes } from 'react';
import { useFileUploader } from '../../FileUploader';
import styles from '../../FileUploader.module.scss';
import classNames from 'classnames';

type FileListProps = {
    /** true면 image 제외(file만) */
    onlyFile?: boolean;
    renderItem?: (
        item: { id: string; kind: 'image' | 'file'; name: string; size: number; type: string; url?: string },
        index: number,
        actions: { remove: () => void }
    ) => React.ReactNode;
    children?: React.ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export const FileList: React.FC<FileListProps> = ({ renderItem, children, onlyFile = true, ...props }) => {
    const { fileUploaderValue, removeById } = useFileUploader();
    const list = onlyFile ? fileUploaderValue.filter((v) => v.kind === 'file') : fileUploaderValue;

    const fileListClassName = classNames(styles.FileList, props.className);

    if (children || list.length === 0) return <>{children}</>;

    return (
        <div {...props} className={fileListClassName}>
            {list.map((it, idx) =>
                renderItem ? (
                    <React.Fragment key={`${it.id}-${idx}`}>
                        {renderItem(it, idx, { remove: () => removeById(it.id) })}
                    </React.Fragment>
                ) : (
                    <div key={`${it.id}-${idx}`} className={styles.FileItem}>
                        <span className={styles.FileName}>{it.name}</span>
                        <button className={styles.RemoveButton} type="button" onClick={() => removeById(it.id)}>
                            삭제
                        </button>
                    </div>
                )
            )}
        </div>
    );
};

export default FileList;
