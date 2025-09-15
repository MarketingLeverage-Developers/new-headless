import React, { useEffect, useRef } from 'react';
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

    // 바디 스크롤 잠금
    useEffect(() => {
        if (!open) return;
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
        };
    }, [open]);

    const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className={`${styles.Overlay} ${open ? styles.open : ''}`}
            aria-hidden={!open}
            onMouseDown={handleBackdropClick}
        >
            <div
                className={`${styles.Sheet} ${open ? styles.open : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-sheet-title"
                ref={sheetRef}
                style={{ height }}
            >
                {/* 핸들 (상단 작은 바) */}
                <div className={styles.Handle} aria-hidden />

                {/* 내용 */}
                <div className={styles.Content}>{children}</div>
            </div>
        </div>
    );
};

export default BottomSheet;
