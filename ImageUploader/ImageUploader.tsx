// 목적: Headless ImageUploader (Select 컨트롤드/언컨트롤드 패턴)
import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react';
import classNames from 'classnames';
import styles from './ImageUploader.module.scss';
import { Controls, Dropzone, FileList, ImageList } from './components';

export type ImageItem = {
    id: string;
    url: string;
    name?: string;
    owned?: boolean;
};

export type ImageItemInput = {
    id?: string;
    url: string;
    name?: string;
    owned?: boolean;
};

type ImageUploaderContextType = {
    imageUploaderValue: ImageItem[];
    changeImageUploaderValue: (next: ImageItem[]) => void;
    isActive: (id: string) => boolean;
    addFiles: (files: File[] | FileList) => void;
    removeById: (id: string) => void;
    clear: () => void;
    openFileDialog: () => void;

    dragging: boolean;
    accept?: string;
    multiple: boolean;
    maxFiles?: number;
    maxSize?: number;
};

const ImageUploaderContext = createContext<ImageUploaderContextType>({
    imageUploaderValue: [],
    changeImageUploaderValue: () => {},
    isActive: () => false,
    addFiles: () => {},
    removeById: () => {},
    clear: () => {},
    openFileDialog: () => {},
    dragging: false,
    accept: 'image/*',
    multiple: true,
});

export type ImageUploaderProps = {
    children: React.ReactNode;
    defaultValue?: ImageItemInput[];
    value?: ImageItemInput[];
    onChange?: (next: ImageItem[]) => void;
    accept?: string;
    multiple?: boolean;
    maxFiles?: number;
    maxSize?: number;
} & React.HTMLAttributes<HTMLDivElement>;

type ImageUploaderComponent = React.FC<ImageUploaderProps> & {
    Dropzone: typeof Dropzone;
    FileList: typeof FileList;
    ImageList: typeof ImageList;
    Controls: typeof Controls;
};

const normalize = (arr: ImageItemInput[]): ImageItem[] => {
    const used = new Set<string>();
    return arr.map((it, idx) => {
        const base = it.id ?? it.url ?? String(idx);
        let id = base,
            n = 1;
        while (used.has(id)) {
            n += 1;
            id = `${base}__${n}`;
        }
        used.add(id);
        return { id, url: it.url, name: it.name, owned: it.owned };
    });
};

const ImageUploader = (({
    children,
    defaultValue,
    value,
    onChange,
    accept = 'image/*',
    multiple = true,
    maxFiles,
    maxSize,
    className,
    ...props
}: ImageUploaderProps) => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<ImageItem[]>(normalize(defaultValue ?? []));
    const currentValue = useMemo<ImageItem[]>(
        () => (isControlled ? normalize(value ?? []) : internalValue),
        [isControlled, value, internalValue]
    );

    const ownedPrevRef = useRef<Set<string>>(new Set());

    const changeImageUploaderValue = (next: ImageItem[]) => {
        const nextOwned = new Set(next.filter((i) => i.owned).map((i) => i.url));
        ownedPrevRef.current.forEach((url) => {
            if (!nextOwned.has(url)) {
                try {
                    URL.revokeObjectURL(url);
                } catch {
                    return;
                }
            }
        });
        ownedPrevRef.current = nextOwned;

        if (isControlled) onChange?.(next);
        else {
            setInternalValue(next);
            onChange?.(next);
        }
    };

    const isActive = (id: string) => currentValue.some((i) => i.id === id);

    const addFiles = (filesLike: File[] | FileList) => {
        const arr = Array.from<File>(filesLike);
        const valid = arr.filter((f) => {
            if (!f.type.startsWith('image/')) return false;
            if (maxSize && f.size > maxSize) return false;
            return true;
        });

        const added: ImageItem[] = valid.map((f) => {
            const url = URL.createObjectURL(f);
            return { id: url, url, name: f.name, owned: true };
        });

        const merged = multiple ? [...currentValue, ...added] : added.slice(0, 1);

        const seen = new Set<string>();
        const deduped: ImageItem[] = [];
        for (const it of merged) {
            if (!seen.has(it.url)) {
                seen.add(it.url);
                deduped.push(it);
            }
        }

        const limited = maxFiles !== undefined ? deduped.slice(0, maxFiles) : deduped;
        changeImageUploaderValue(limited);
    };

    const removeById = (id: string) => {
        const target = currentValue.find((i) => i.id === id);
        if (!target) return;
        if (target.owned) {
            try {
                URL.revokeObjectURL(target.url);
            } catch {
                return;
            }
            ownedPrevRef.current.delete(target.url);
        }
        changeImageUploaderValue(currentValue.filter((i) => i.id !== id));
    };

    const clear = () => {
        currentValue.forEach((i) => {
            if (i.owned) {
                try {
                    URL.revokeObjectURL(i.url);
                } catch {
                    return;
                }
            }
        });
        ownedPrevRef.current.clear();
        changeImageUploaderValue([]);
    };

    const inputRef = useRef<HTMLInputElement | null>(null);
    const openFileDialog = () => inputRef.current?.click();

    // dragover heartbeat (window + overlay 둘 다에서 하트비트 유지)
    const [dragging, setDragging] = useState(false);
    const draggingRef = useRef(false);
    const hbTimerRef = useRef<number | null>(null);

    const keepAlive = () => {
        if (!draggingRef.current) {
            draggingRef.current = true;
            setDragging(true);
        }
        if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
        hbTimerRef.current = window.setTimeout(() => {
            draggingRef.current = false;
            setDragging(false);
            hbTimerRef.current = null;
        }, 300);
    };

    useEffect(() => {
        const onWinDragOver = (e: DragEvent) => {
            if (!e.dataTransfer) return;
            const hasFiles = Array.from(e.dataTransfer.types || []).includes('Files');
            if (!hasFiles) return;
            e.preventDefault();
            keepAlive();
        };
        const onWinDrop = (e: DragEvent) => {
            e.preventDefault();
            if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
            draggingRef.current = false;
            setDragging(false);
        };
        window.addEventListener('dragover', onWinDragOver);
        window.addEventListener('drop', onWinDrop);
        return () => {
            window.removeEventListener('dragover', onWinDragOver);
            window.removeEventListener('drop', onWinDrop);
            if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
        };
    }, []);

    const onOverlayDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        keepAlive();
    };

    const onOverlayDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer?.files;
        if (files?.length) addFiles(files);
        if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
        draggingRef.current = false;
        setDragging(false);
        e.dataTransfer?.clearData();
    };

    const onPaste = (e: React.ClipboardEvent) => {
        const pasted = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'));
        if (pasted.length) addFiles(pasted);
    };

    const ctx = useMemo<ImageUploaderContextType>(
        () => ({
            imageUploaderValue: currentValue,
            changeImageUploaderValue,
            isActive,
            addFiles,
            removeById,
            clear,
            openFileDialog,
            dragging,
            accept,
            multiple,
            maxFiles,
            maxSize,
        }),
        [currentValue, dragging, accept, multiple, maxFiles, maxSize]
    );

    return (
        <ImageUploaderContext.Provider value={ctx}>
            <div {...props} className={classNames(styles.Root)} onPaste={onPaste}>
                <input
                    ref={inputRef}
                    className={styles.Input}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={(e) => {
                        if (e.currentTarget.files) addFiles(e.currentTarget.files);
                        e.currentTarget.value = '';
                    }}
                    tabIndex={-1}
                />
                <div
                    className={styles.EventsCatcher}
                    data-dragging={dragging ? 'true' : 'false'}
                    onDragOver={onOverlayDragOver}
                    onDrop={onOverlayDrop}
                />
                {children}
            </div>
        </ImageUploaderContext.Provider>
    );
}) as ImageUploaderComponent;

export const useImageUploader = () => useContext(ImageUploaderContext);

ImageUploader.Dropzone = Dropzone;
ImageUploader.FileList = FileList;
ImageUploader.ImageList = ImageList;
ImageUploader.Controls = Controls;

export default ImageUploader;
export { ImageUploader };
