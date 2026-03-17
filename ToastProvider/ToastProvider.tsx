import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Provider 내부 타입 정의 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastPosition = 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';

export type Toast = {
    id: string;
    message: string;
    title?: string;
    type?: ToastType;
    /** ms. 0이면 자동 종료 안 함 */
    duration?: number;
    /** 닫기 버튼 표시 여부 (기본 true) */
    dismissible?: boolean;
    /** "😊" 같은 이모지 */
    icon?: string | React.ReactElement;
};

export type AddToastInput = Omit<Toast, 'id'>;

export type ToastProviderConfig = {
    position?: ToastPosition;
    defaultDuration?: number; // 기본 표시 시간(ms)
    maxToasts?: number; // 최대 동시 노출 개수
};

type ToastContextType = {
    toasts: Toast[];
    addToast: (toast: AddToastInput) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
    position: ToastPosition;
    defaultDuration: number;
};

const ToastContext = createContext<ToastContextType | null>(null);

type Props = React.PropsWithChildren<{ config?: ToastProviderConfig }>;

/** 전역 토스트 상태 제공 (헤드리스) */
export const ToastProvider: React.FC<Props> = ({ config, children }) => {
    const { position = 'bottom-left', defaultDuration = 2400, maxToasts = 4 } = config ?? {};

    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback(
        (toast: AddToastInput) => {
            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            setToasts((prev) => {
                const next = [...prev, { ...toast, id }];
                if (next.length > maxToasts) next.shift();
                return next;
            });
            return id;
        },
        [maxToasts]
    );

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => setToasts([]), []);

    const value = useMemo<ToastContextType>(
        () => ({
            toasts,
            addToast,
            removeToast,
            clearToasts,
            position,
            defaultDuration,
        }),
        [toasts, addToast, removeToast, clearToasts, position, defaultDuration]
    );

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextType => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
