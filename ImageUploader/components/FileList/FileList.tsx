import React, { type HTMLAttributes } from 'react';
import { useImageUploader } from '../../ImageUploader';
import styles from '../../ImageUploader.module.scss';
import classNames from 'classnames';

type FileListProps = {
    renderItem?: (
        item: { id: string; url: string; name?: string },
        index: number,
        actions: { remove: () => void }
    ) => React.ReactNode;
    children?: React.ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export const FileList: React.FC<FileListProps> = ({ renderItem, children, ...props }) => {
    const { imageUploaderValue, removeById } = useImageUploader();

    const fileListClassName = classNames(styles.FileList, props.className);

    if (children || imageUploaderValue.length === 0) {
        return <>{children}</>;
    }

    return (
        <div {...props} className={fileListClassName}>
            {imageUploaderValue.map((it, idx) =>
                renderItem ? (
                    <React.Fragment key={it.id}>
                        {renderItem(it, idx, { remove: () => removeById(it.id) })}
                    </React.Fragment>
                ) : (
                    <div key={it.id} className={styles.FileItem}>
                        <span className={styles.FileName}>{it.name ?? it.url}</span>
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
