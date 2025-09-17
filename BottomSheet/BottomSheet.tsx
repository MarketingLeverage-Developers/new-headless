import React, { useEffect, useRef, useState } from 'react';
import styles from './BottomSheet.module.scss';

type BottomSheetProps = {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    closeOnBackdrop?: boolean;
    height?: number | string;
};

const BottomSheet: React.FC<BottomSheetProps> = ({
    open,
    onClose,
    children,
    closeOnBackdrop = true,
    height = '65vh',
}) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);

    // 드래그 상태
    const [dragging, setDragging] = useState(false);
    const [dragY, setDragY] = useState(0);
    const startYRef = useRef(0);
    const pointerIdRef = useRef<number | null>(null);

    // 바디 스크롤 잠금
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    // 열릴 때마다 드래그 상태 초기화
    useEffect(() => {
        if (open) {
            setDragging(false);
            setDragY(0);
            pointerIdRef.current = null;
        }
    }, [open]);

    const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
    };

    // ===== 드래그 로직 (핸들에서만 시작) =====
    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!open) return;
        // 마우스 오른쪽 버튼 등 제외
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        pointerIdRef.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        startYRef.current = e.clientY;
    };

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!dragging || pointerIdRef.current !== e.pointerId) return;
        const dy = Math.max(0, e.clientY - startYRef.current);
        setDragY(dy);
    };

    const finishDrag = (velocityY = 0) => {
        const sheetH = sheetRef.current?.getBoundingClientRect().height ?? 0;
        // 닫힘 기준: 드래그 거리 20% 이상 또는 120px 이상 또는 빠른 하향 스와이프
        const distanceOK = dragY >= Math.max(120, sheetH * 0.2);
        const velocityOK = velocityY > 1.0; // px/ms 대략치

        if (distanceOK || velocityOK) {
            onClose();
            // 닫히는 동안 상태 초기화는 useEffect(open)에서 처리
        } else {
            // 원위치 애니메이션(transition은 CSS에서 제어)
            setDragY(0);
            setDragging(false);
        }
    };

    // 속도 계산을 위한 타임스탬프/위치 샘플
    const lastSampleRef = useRef({ t: 0, y: 0 });
    const onPointerUpOrCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

        // 간단한 속도 추정
        const now = performance.now();
        const dt = now - lastSampleRef.current.t || 1;
        const dy = dragY - lastSampleRef.current.y;
        const v = dy / dt; // px/ms

        finishDrag(v);
        pointerIdRef.current = null;
    };

    // 샘플링(옵션: 조금 더 정확한 속도)
    useEffect(() => {
        if (!dragging) return;
        const id = requestAnimationFrame(() => {
            lastSampleRef.current = { t: performance.now(), y: dragY };
        });
        return () => cancelAnimationFrame(id);
    }, [dragging, dragY]);

    return (
        <div
            className={`${styles.Overlay} ${open ? styles.open : ''}`}
            aria-hidden={!open}
            onMouseDown={handleBackdropClick}
        >
            <div
                className={`${styles.Sheet} ${open ? styles.open : ''} ${dragging ? styles.dragging : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-sheet-title"
                ref={sheetRef}
                style={{
                    height,
                    // 열려 있을 때만 드래그 변환 적용 (닫힘 애니메이션은 기존 CSS에 맡김)
                    transform: open ? `translateY(${dragY}px)` : undefined,
                }}
            >
                {/* 핸들 (상단 작은 바) */}
                <div
                    ref={handleRef}
                    className={styles.Handle}
                    aria-hidden
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUpOrCancel}
                    onPointerCancel={onPointerUpOrCancel}
                />

                {/* 내용 */}
                <div className={styles.Content}>{children}</div>
            </div>
        </div>
    );
};

export default BottomSheet;
