// shared/headless/FileUploader/FileUploader.tsx
// 목적: Headless FileUploader (컨트롤드/언컨트롤드) - 이미지/파일 통합 관리
// - FileUploader는 단일 상태(FileItem[])로 image/file을 모두 관리합니다.
// - kind: 'image' | 'file' 로 구분해 ImageList/FileList에서 필터링 가능합니다.
// - onResolveFiles(files, mode)를 구현하면 API 업로드 후 응답을 UI 아이템으로 치환할 수 있습니다.
// - Dropzone/Controls/FileList/ImageList는 static property로 제공합니다.

import React, { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import styles from './FileUploader.module.scss';
import { Controls, Dropzone, FileList, ImageList } from './components';

export type UploaderKind = 'image' | 'file';

export type FileItem = {
    id: string;
    kind: UploaderKind;

    name: string;
    size: number;
    type: string;

    url?: string; // objectURL or server url
    owned?: boolean; // true: createObjectURL로 만든 로컬 리소스(해제 대상), false: 서버 리소스
};

export type FileItemInput = {
    id?: string;
    kind: UploaderKind;

    name: string;
    size: number;
    type: string;

    url?: string;
    owned?: boolean;
};

export type AddMode =
    | { kind: 'image'; accept?: string; multiple?: boolean }
    | { kind: 'file'; accept?: string; multiple?: boolean }
    | { kind: 'any'; accept?: string; multiple?: boolean };

type FileUploaderContextType = {
    fileUploaderValue: FileItem[];
    changeFileUploaderValue: (next: FileItem[]) => void;
    isActive: (id: string) => boolean;

    addFiles: (files: File[] | FileList, mode?: AddMode) => Promise<void>;
    removeById: (id: string) => void;
    clear: () => void;

    /**
     * 파일 선택 다이얼로그 열기
     * - mode.accept를 input accept로 적용
     * - 실제 추가는 input change에서 addFiles(..., {kind:'any'})로 들어옴
     *   (필요하면 headful에서 별도 onChange 구현해 mode를 유지하는 것도 가능)
     */
    openFileDialog: (mode?: AddMode) => void;

    dragging: boolean;
    maxFiles?: number;
    maxSize?: number;

    // Dialog accept를 런타임에 바꾸기 위한 상태
    dialogAccept: string;
    multiple: boolean;
};

const FileUploaderContext = createContext<FileUploaderContextType>({
    fileUploaderValue: [],
    changeFileUploaderValue: () => {},
    isActive: () => false,
    addFiles: async () => {},
    removeById: () => {},
    clear: () => {},
    openFileDialog: () => {},
    dragging: false,
    maxFiles: undefined,
    maxSize: undefined,
    dialogAccept: '*/*',
    multiple: true,
});

export type FileUploaderProps = {
    children: React.ReactNode;
    defaultValue?: FileItem[];
    value?: FileItemInput[];
    onChange?: (next: FileItem[]) => void;

    multiple?: boolean;
    maxFiles?: number;
    maxSize?: number;

    /**
     * 사용자가 고른 File[]을 API 업로드 등으로 변환해 FileItemInput[]을 돌려주는 훅
     * - mode.kind로 image/file 분기 가능
     * - 반환 아이템의 owned는 보통 false (서버 리소스)
     * - 미구현 시, 기본 동작: createObjectURL로 로컬 url 생성(owned: true)
     */
    onResolveFiles?: (files: File[], mode: AddMode) => Promise<FileItemInput[]>;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

type FileUploaderComponent = React.FC<FileUploaderProps> & {
    Dropzone: typeof Dropzone;
    FileList: typeof FileList;
    ImageList: typeof ImageList;
    Controls: typeof Controls;
};

/** accept 문자열을 드롭 파일에 적용하기 위한 최소 파서 */
const matchAccept = (file: File, accept?: string) => {
    if (!accept || accept.trim() === '' || accept === '*/*') return true;

    const tokens = accept
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();

    // 예: ".pdf", "image/*", "application/pdf"
    return tokens.some((tok) => {
        if (tok === '*/*') return true;
        if (tok.startsWith('.')) return name.endsWith(tok);
        if (tok.endsWith('/*')) {
            const prefix = tok.slice(0, -2); // "image"
            return type.startsWith(`${prefix}/`);
        }
        return type === tok;
    });
};

const normalize = (arr: FileItemInput[]): FileItem[] => {
    const used = new Set<string>();

    return arr.map((it, idx) => {
        // id가 없으면 (url || meta || idx) 기반
        const base =
            it.id ?? it.url ?? (it.name ? `${it.kind}__${it.name}__${it.size}__${it.type}` : `${it.kind}__${idx}`);

        let id = base;
        let n = 1;
        while (used.has(id)) {
            n += 1;
            id = `${base}__${n}`;
        }
        used.add(id);

        return {
            id,
            kind: it.kind,
            name: it.name,
            size: it.size,
            type: it.type,
            url: it.url,
            owned: it.owned,
        };
    });
};

const dedupeKey = (it: FileItem) => {
    // 서버 url이 있으면 url을 우선 키로 사용, 없으면 kind+name+size+type
    if (it.url) return `url:${it.url}`;
    return `meta:${it.kind}:${it.name}:${it.size}:${it.type}`;
};

const FileUploader = (({
    children,
    defaultValue,
    value,
    onChange,
    multiple = true,
    maxFiles,
    maxSize,
    onResolveFiles,
    className,
    ...props
}: FileUploaderProps) => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<FileItem[]>(normalize(defaultValue ?? []));
    const currentValue = useMemo<FileItem[]>(
        () => (isControlled ? normalize(value ?? []) : internalValue),
        [isControlled, value, internalValue]
    );

    // objectURL 관리(owned=true만 revoke)
    const ownedPrevRef = useRef<Set<string>>(new Set());

    const changeFileUploaderValue = useCallback(
        (next: FileItem[]) => {
            const nextOwned = new Set(next.filter((i) => i.owned && i.url).map((i) => i.url as string));

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
        },
        [isControlled, onChange]
    );

    const isActive = (id: string) => currentValue.some((i) => i.id === id);

    /** 파일 선택 dialog accept를 런타임에 바꾸기 위한 state */
    const [dialogAccept, setDialogAccept] = useState<string>('*/*');
    const [dialogMultiple, setDialogMultiple] = useState<boolean>(multiple);

    /** 파일 추가(드롭/선택/붙여넣기 공통 진입점) */
    const addFiles = useCallback(
        async (filesLike: File[] | FileList, mode: AddMode = { kind: 'any', accept: '*/*' }) => {
            const arr = Array.from<File>(filesLike);

            const accept =
                mode.kind === 'image'
                    ? mode.accept ?? 'image/*'
                    : mode.kind === 'file'
                    ? mode.accept ?? '*/*'
                    : mode.accept ?? '*/*';

            const filtered = arr.filter((f) => {
                if (maxSize && f.size > maxSize) return false;

                // image 모드면 mime 1차 제한
                if (mode.kind === 'image' && !f.type.startsWith('image/')) return false;

                // accept 기반(드롭은 input accept를 무시할 수 있으니 JS에서도 체크)
                if (!matchAccept(f, accept)) return false;

                return true;
            });

            if (filtered.length === 0) return;

            let incoming: FileItem[] = [];

            if (onResolveFiles) {
                // 1) 사용자 정의: API 업로드 → 응답을 FileItemInput[]으로 치환
                const resolved = await onResolveFiles(filtered, mode);
                incoming = normalize(resolved ?? []);
                incoming = incoming.map((i) => ({ ...i, owned: i.owned ?? false }));
            } else {
                // 2) 기본: 로컬 objectURL 생성(다운로드/미리보기용)
                incoming = filtered.map((f) => {
                    const isImg = f.type.startsWith('image/');
                    const url = URL.createObjectURL(f);

                    const kind: UploaderKind =
                        mode.kind === 'image' ? 'image' : mode.kind === 'file' ? 'file' : isImg ? 'image' : 'file';

                    return {
                        id: url,
                        kind,
                        name: f.name,
                        size: f.size,
                        type: f.type,
                        url,
                        owned: true,
                    };
                });
            }

            const allowMulti = mode.multiple ?? multiple;

            // single일 때 "전체 교체" 금지. kind별로만 교체!
            let merged: FileItem[] = [];

            if (allowMulti) {
                merged = [...currentValue, ...incoming];
            } else {
                if (mode.kind === 'image' || mode.kind === 'file') {
                    merged = [...currentValue.filter((v) => v.kind !== mode.kind), ...incoming.slice(0, 1)];
                } else {
                    // any인데 single이면 전체 1개로 교체(기본 동작)
                    merged = incoming.slice(0, 1);
                }
            }

            const seen = new Set<string>();
            const deduped: FileItem[] = [];
            for (const it of merged) {
                const key = dedupeKey(it);
                if (!seen.has(key)) {
                    seen.add(key);
                    deduped.push(it);
                }
            }

            const limited = maxFiles !== undefined ? deduped.slice(0, maxFiles) : deduped;
            changeFileUploaderValue(limited);
        },
        [changeFileUploaderValue, currentValue, maxFiles, maxSize, multiple, onResolveFiles]
    );

    const removeById = (id: string) => {
        const target = currentValue.find((i) => i.id === id);
        if (!target) return;
        if (target.owned && target.url) {
            try {
                URL.revokeObjectURL(target.url);
            } catch {
                /* noop */
            }
            ownedPrevRef.current.delete(target.url);
        }
        changeFileUploaderValue(currentValue.filter((i) => i.id !== id));
    };

    const clear = () => {
        currentValue.forEach((i) => {
            if (i.owned && i.url) {
                try {
                    URL.revokeObjectURL(i.url);
                } catch {
                    /* noop */
                }
            }
        });
        ownedPrevRef.current.clear();
        changeFileUploaderValue([]);
    };

    const inputRef = useRef<HTMLInputElement | null>(null);
    const openFileDialog = (mode: AddMode = { kind: 'any', accept: '*/*' }) => {
        const nextAccept = mode.kind === 'image' ? mode.accept ?? 'image/*' : mode.accept ?? '*/*';

        setDialogAccept(nextAccept);
        setDialogMultiple(mode.multiple ?? multiple); // ✅ 모드 우선
        inputRef.current?.click();
    };

    // dragover heartbeat (단 하나)
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
        if (files?.length) {
            // 전역 drop은 any로 받고 자동 분류
            await addFiles(files, { kind: 'any', accept: dialogAccept ?? '*/*' });
        }
        if (hbTimerRef.current) window.clearTimeout(hbTimerRef.current);
        draggingRef.current = false;
        setDragging(false);
        e.dataTransfer?.clearData();
    };

    const onPaste = async (e: React.ClipboardEvent) => {
        const pasted = Array.from(e.clipboardData.files || []);
        if (pasted.length) await addFiles(pasted, { kind: 'any', accept: '*/*' });
    };

    const ctx = useMemo<FileUploaderContextType>(
        () => ({
            fileUploaderValue: currentValue,
            changeFileUploaderValue,
            isActive,
            addFiles,
            removeById,
            clear,
            openFileDialog,
            dragging,
            maxFiles,
            maxSize,
            dialogAccept,
            multiple,
        }),
        [currentValue, changeFileUploaderValue, addFiles, dragging, maxFiles, maxSize, dialogAccept, multiple]
    );

    return (
        <FileUploaderContext.Provider value={ctx}>
            <div {...props} className={classNames(styles.Root, className)} onPaste={onPaste}>
                <input
                    ref={inputRef}
                    className={styles.Input}
                    type="file"
                    accept={dialogAccept}
                    multiple={dialogMultiple}
                    onChange={async (e) => {
                        const el = e.currentTarget;
                        const files = el.files;
                        try {
                            if (files) await addFiles(files, { kind: 'any', accept: dialogAccept });
                        } finally {
                            if (el) el.value = '';
                        }
                    }}
                    tabIndex={-1}
                />

                {/* 화면 전체 드래그 수신 오버레이 (단 하나) */}
                <div
                    className={styles.EventsCatcher}
                    data-dragging={dragging ? 'true' : 'false'}
                    onDragOver={onOverlayDragOver}
                    onDrop={onOverlayDrop}
                />

                {children}
            </div>
        </FileUploaderContext.Provider>
    );
}) as FileUploaderComponent;

export const useFileUploader = () => {
    const ctx = useContext(FileUploaderContext);
    return ctx;
};

FileUploader.Dropzone = Dropzone;
FileUploader.FileList = FileList;
FileUploader.ImageList = ImageList;
FileUploader.Controls = Controls;

export default FileUploader;
export { FileUploader };
