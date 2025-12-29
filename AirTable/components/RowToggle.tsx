import React, { useMemo } from 'react';
import type { CellRenderMeta } from '../AirTable';
import { FiChevronRight } from 'react-icons/fi';
import styles from './RowToggle.module.scss';

export type RowToggleProps<T> = {
    meta: CellRenderMeta<T>;
    onToggle?: () => void;
    className?: string;
    style?: React.CSSProperties;
};

const stopOnly = (e: React.SyntheticEvent) => {
    e.stopPropagation();
};

export const RowToggle = <T,>({ meta, onToggle, className, style }: RowToggleProps<T>) => {
    const isOpen = useMemo(() => meta.isRowExpanded(meta.rowKey), [meta]);

    return (
        <button
            type="button"
            data-row-toggle="true"
            aria-expanded={isOpen}
            className={[styles.toggle, isOpen ? styles.open : '', className ?? ''].filter(Boolean).join(' ')}
            style={style}
            // ✅ 부모 셀의 selection/drag 로직에 절대 안 섞이게 전파만 차단
            onPointerDownCapture={stopOnly}
            onMouseDownCapture={stopOnly}
            onClickCapture={stopOnly}
            onPointerDown={stopOnly}
            onMouseDown={stopOnly}
            onClick={(e) => {
                e.stopPropagation();
                meta.toggleRowExpanded(meta.rowKey);
                onToggle?.();
            }}
        >
            <FiChevronRight className={styles.icon} />
        </button>
    );
};

export default RowToggle;
