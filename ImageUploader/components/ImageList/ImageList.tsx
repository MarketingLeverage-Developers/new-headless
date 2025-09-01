import React, { type HTMLAttributes } from 'react';
import { useImageUploader } from '../../ImageUploader';
import styles from '../../ImageUploader.module.scss';
import classNames from 'classnames';

type Props = {
    renderItem?: (
        item: { id: string; url: string; name?: string },
        index: number,
        actions: { remove: () => void }
    ) => React.ReactNode;
    children?: React.ReactNode;
    imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
} & HTMLAttributes<HTMLDivElement>;

export const ImageList: React.FC<Props> = ({ renderItem, children, imgProps, ...props }) => {
    const { imageUploaderValue, removeById } = useImageUploader();
    const imageListClassName = classNames(styles.ImageList, props.className);

    if (children || imageUploaderValue.length === 0) {
        return <>{children}</>;
    }

    return (
        <div {...props} className={imageListClassName}>
            {imageUploaderValue.map((it, idx) =>
                renderItem ? (
                    <React.Fragment key={it.id}>
                        {renderItem(it, idx, { remove: () => removeById(it.id) })}
                    </React.Fragment>
                ) : (
                    <div key={it.id} className={styles.ImageItem}>
                        <img className={styles.Preview} src={it.url} alt={it.name ?? it.id} {...imgProps} />
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
