import React from 'react';
import { useAirTableContext } from '../AirTable';

type GhostProps = {
    className?: string;
};

export const Ghost = <T,>({ className }: GhostProps) => {
    const { ghost, lastMouseClientRef, props, state } = useAirTableContext<T>();

    if (!ghost) return null;

    return (
        <div
            className={className}
            style={{
                position: 'fixed',
                top: (lastMouseClientRef.current?.y ?? 0) - 180,
                left: ghost.leftInGrid + ghost.offsetX,
                width: ghost.width,
                height: 44,
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8,
                boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                zIndex: 2147483647,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                fontWeight: 600,
                transform: 'translateY(4px)',
            }}
        >
            {state.columnRow.columns.find((c) => c.key === ghost.key)?.render(ghost.key, props.data)}
        </div>
    );
};
