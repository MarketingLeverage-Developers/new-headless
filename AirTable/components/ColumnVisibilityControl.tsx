import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAirTableContext } from '../AirTable';

export const ColumnVisibilityControl = <T,>() => {
    const { state } = useAirTableContext<T>();
    const { allLeafColumns, allLeafKeys, visibleColumnKeys, setVisibleColumnKeys } = state;

    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        };

        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggle = useCallback(
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

    return (
        <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', gap: 8, marginBottom: 8 }}>
            <button
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

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: 240,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 10,
                        boxShadow: '0 10px 20px rgba(0,0,0,0.12)',
                        padding: 12,
                        zIndex: 9999,
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
                                        onChange={() => toggle(col.key)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>{label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
