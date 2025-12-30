import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAirTableContext } from '../AirTable';

type Props = {
    portalId?: string;
};

type Rect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export const ColumnVisibilityControl = <T,>({ portalId }: Props) => {
    const { state } = useAirTableContext<T>();
    const { allLeafColumns, allLeafKeys, visibleColumnKeys, setVisibleColumnKeys } = state;

    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState<Rect | null>(null);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const portalEl = useMemo(() => {
        if (!portalId) return null;
        return document.getElementById(portalId);
    }, [portalId]);

    const toggleColumn = useCallback(
        (key: string) => {
            const has = visibleColumnKeys.includes(key);
            const next = has ? visibleColumnKeys.filter((k) => k !== key) : [...visibleColumnKeys, key];
            if (next.length === 0) return;
            setVisibleColumnKeys(next);
        },
        [visibleColumnKeys, setVisibleColumnKeys]
    );

    const handleAllOn = useCallback(() => {
        setVisibleColumnKeys(allLeafKeys);
    }, [setVisibleColumnKeys, allLeafKeys]);

    const handleAllOff = useCallback(() => {
        if (allLeafKeys.length === 0) return;
        setVisibleColumnKeys([allLeafKeys[0]]);
    }, [setVisibleColumnKeys, allLeafKeys]);

    const close = useCallback(() => {
        setOpen(false);
    }, []);

    const updateRect = useCallback(() => {
        const btn = buttonRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        setAnchorRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        updateRect();
    }, [open, updateRect]);

    useEffect(() => {
        if (!open) return;

        const handle = () => updateRect();

        window.addEventListener('scroll', handle, true);
        window.addEventListener('resize', handle);

        return () => {
            window.removeEventListener('scroll', handle, true);
            window.removeEventListener('resize', handle);
        };
    }, [open, updateRect]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;

            const dropdown = document.getElementById('__airtable_col_dropdown__');
            if (dropdown && dropdown.contains(target)) return;

            const trigger = document.getElementById('__airtable_col_trigger__');
            if (trigger && trigger.contains(target)) return;

            close();
        };

        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [close]);

    const trigger = (
        <div ref={wrapRef} id="__airtable_col_trigger__" style={{ display: 'inline-flex', gap: 8 }}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e5e5',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                }}
            >
                컬럼 설정
            </button>
        </div>
    );

    const dropdown = open && anchorRect && (
        <div
            id="__airtable_col_dropdown__"
            style={{
                position: 'fixed',
                top: anchorRect.top + anchorRect.height + 6,
                left: anchorRect.left,
                width: 240,
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                boxShadow: '0 10px 20px rgba(0,0,0,0.12)',
                padding: 12,
                zIndex: 2147483647,
            }}
        >
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                    type="button"
                    onClick={handleAllOn}
                    style={{
                        flex: 1,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid #e5e5e5',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    모두 켜기
                </button>
                <button
                    type="button"
                    onClick={handleAllOff}
                    style={{
                        flex: 1,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid #e5e5e5',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    모두 끄기
                </button>
            </div>

            <div style={{ maxHeight: 260, overflow: 'auto', paddingRight: 4 }}>
                {allLeafColumns.map((col) => {
                    const checked = visibleColumnKeys.includes(col.key);
                    const label = col.label ?? col.key;

                    return (
                        <label
                            key={col.key}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 4px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontSize: 13,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleColumn(col.key)}
                                style={{ cursor: 'pointer' }}
                            />
                            <span>{label}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );

    // ✅ portalId가 있으면 trigger까지 portal로 보내야 한다.
    if (portalEl) {
        return (
            <>
                {createPortal(trigger, portalEl)}
                {createPortal(dropdown, portalEl)}
            </>
        );
    }

    return (
        <>
            {trigger}
            {dropdown}
        </>
    );
};
