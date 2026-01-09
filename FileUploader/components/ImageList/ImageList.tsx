// shared/headless/FileUploader/components/ImageList/ImageList.tsx
import React, { type HTMLAttributes } from 'react';
import { useFileUploader } from '../../FileUploader';
import styles from '../../FileUploader.module.scss';
import classNames from 'classnames';

type Props = {
    renderItem?: (
        item: { id: string; kind: 'image' | 'file'; name: string; size: number; type: string; url?: string },
        index: number,
        actions: { remove: () => void }
    ) => React.ReactNode;
    children?: React.ReactNode;
    imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
} & HTMLAttributes<HTMLDivElement>;

export const ImageList: React.FC<Props> = ({ renderItem, children, imgProps, ...props }) => {
    const { fileUploaderValue, removeById } = useFileUploader();
    const images = fileUploaderValue.filter((v) => v.kind === 'image');
    const imageListClassName = classNames(styles.ImageList, props.className);

    if (children || images.length === 0) return <>{children}</>;

    return (
        <div {...props} className={imageListClassName}>
            {images.map((it, idx) =>
                renderItem ? (
                    <React.Fragment key={it.id}>
                        {renderItem(it, idx, { remove: () => removeById(it.id) })}
                    </React.Fragment>
                ) : (
                    <div key={it.id} className={styles.ImageItem}>
                        {it.url ? (
                            <img className={styles.Preview} src={it.url} alt={it.name ?? it.id} {...imgProps} />
                        ) : null}
                        <button className={styles.RemoveButton} type="button" onClick={() => removeById(it.id)}>
                            삭제
                        </button>
                    </div>
                )
            )}
        </div>
    );
};

export default ImageList;
