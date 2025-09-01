// 알약 스타일 토스트 컨테이너 + 아이템 (애니메이션 전용)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './ToastProvider';
import type { Toast, ToastPosition } from './ToastProvider';
import styles from './ToastContainer.module.scss';

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const usePrefersReducedMotion = (): boolean => {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setReduced(media.matches);
        onChange();
        media.addEventListener?.('change', onChange);
        return () => media.removeEventListener?.('change', onChange);
    }, []);
    return reduced;
};

type ToastItemProps = {
    toast: Toast;
    remove: (id: string) => void;
    position: ToastPosition;
    defaultDuration: number;
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, remove, position, defaultDuration }) => {
    const [phase, setPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
    const reduced = usePrefersReducedMotion();
    const isTop = ['top-left', 'top-right', 'top-center'].includes(position);
    const duration = typeof toast.duration === 'number' ? toast.duration : defaultDuration;
    const timerRef = useRef<number | null>(null);

    // 등장 → visible
    useEffect(() => {
        const raf = requestAnimationFrame(() => setPhase('visible'));
        return () => cancelAnimationFrame(raf);
    }, []);

    // 자동 퇴장 (duration > 0일 때만)
    useEffect(() => {
        if (phase !== 'visible' || duration <= 0) return;
        timerRef.current = window.setTimeout(() => setPhase('leaving'), duration);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
        };
    }, [phase, duration]);

    const className = cx(
        styles.toast,
        styles.pill,
        phase === 'entering' && (isTop ? styles.enteringTop : styles.enteringBottom),
        phase === 'visible' && styles.visible,
        phase === 'leaving' && (isTop ? styles.leavingTop : styles.leavingBottom),
        reduced && styles.reducedMotion
    );

    const onAnimationEnd: React.AnimationEventHandler<HTMLDivElement> = () => {
        if (phase === 'leaving') remove(toast.id);
    };

    return (
        <div role="status" aria-live="polite" className={className} onAnimationEnd={onAnimationEnd}>
            {toast.icon && (
                <span className={styles.icon} aria-hidden="true">
                    {toast.icon}
                </span>
            )}
            <span className={styles.text}>{toast.message}</span>

            {toast.dismissible !== false && duration <= 0 && (
                <button type="button" aria-label="닫기" className={styles.close} onClick={() => setPhase('leaving')}>
                    ×
                </button>
            )}
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast, position, defaultDuration } = useToast();

    const containerClass = useMemo(() => cx(styles.container, styles[position]), [position]);

    return (
        <div className={containerClass} role="region" aria-live="polite" aria-atomic={true}>
            {toasts.map((t) => (
                <ToastItem
                    key={t.id}
                    toast={t}
                    remove={removeToast}
                    position={position}
                    defaultDuration={defaultDuration}
                />
            ))}
        </div>
    );
};
