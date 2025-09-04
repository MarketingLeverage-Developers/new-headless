// shared/headless/ImageUploader/ImageUploader.tsx
// 목적: Headless ImageUploader (컨트롤드/언컨트롤드) + 파일 업로드 훅(onResolveFiles) 추가
// - onResolveFiles(files): Promise<ImageItemInput[]> 를 구현하면
//   사용자가 고른 File들을 API 업로드 후 응답을 UI 아이템으로 치환할 수 있음.

import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react';
import classNames from 'classnames';
import styles from './ImageUploader.module.scss';
import { Controls, Dropzone, FileList, ImageList } from './components';

export type ImageItem = {
    id: string;
    url: string;
    name?: string;
    owned?: boolean; // true: createObjectURL로 만든 로컬 리소스(해제 대상), false: 서버 리소스
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
    addFiles: (files: File[] | FileList) => Promise<void>;
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
    addFiles: async () => {},
    removeById: () => {},
    clear: () => {},
    openFileDialog: () => {},
    dragging: false,
    accept: 'image/*',
    multiple: true,
});

export type ImageUploaderProps = {
    children: React.ReactNode;
    defaultValue?: ImageItem[];
    value?: ImageItemInput[];
    onChange?: (next: ImageItem[]) => void;
    accept?: string;
    multiple?: boolean;
    maxFiles?: number;
    maxSize?: number;

    /**
     * 사용자가 고른 File[]을 API 업로드 등으로 변환해 ImageItemInput[]을 돌려주는 훅
     * - 반환 아이템의 owned는 보통 false (서버 리소스)
     * - 미구현 시, 기본 동작: createObjectURL로 미리보기(owned: true)
     */
    onResolveFiles?: (files: File[]) => Promise<ImageItemInput[]>;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

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
    onResolveFiles,
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
                    /* noop */
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

    /** 파일 추가(드롭/선택/붙여넣기 공통 진입점) */
    const addFiles = async (filesLike: File[] | FileList) => {
        const arr = Array.from<File>(filesLike);
        const valid = arr.filter((f) => {
            if (!f.type.startsWith('image/')) return false;
            if (maxSize && f.size > maxSize) return false;
            return true;
        });
        if (valid.length === 0) return;

        let incoming: ImageItem[] = [];
        if (onResolveFiles) {
            // 1) 사용자 정의: API 업로드 → 응답을 ImageItemInput[]으로 치환
            const resolved = await onResolveFiles(valid);
            incoming = normalize(resolved ?? []);
            // 서버 리소스는 일반적으로 owned: false 여야 revoke 대상에서 제외됨.
            incoming = incoming.map((i) => ({ ...i, owned: i.owned ?? false }));
        } else {
            // 2) 기본: 로컬 미리보기 URL 생성
            const added: ImageItem[] = valid.map((f) => {
                const url = URL.createObjectURL(f);
                return { id: url, url, name: f.name, owned: true };
            });
            incoming = added;
        }

        const merged = multiple ? [...currentValue, ...incoming] : incoming.slice(0, 1);

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
                /* noop */
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
                    /* noop */
                }
            }
        });
        ownedPrevRef.current.clear();
        changeImageUploaderValue([]);
    };

    const inputRef = useRef<HTMLInputElement | null>(null);
    const openFileDialog = () => inputRef.current?.click();

    // dragover heartbeat
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

    const onOverlayDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer?.files;
        if (files?.length) await addFiles(files);
        if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
        draggingRef.current = false;
        setDragging(false);
        e.dataTransfer?.clearData();
    };

    const onPaste = async (e: React.ClipboardEvent) => {
        const pasted = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'));
        if (pasted.length) await addFiles(pasted);
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
            <div {...props} className={classNames(styles.Root, className)} onPaste={onPaste}>
                <input
                    ref={inputRef}
                    className={styles.Input}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={async (e) => {
                        if (e.currentTarget.files) await addFiles(e.currentTarget.files);
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
