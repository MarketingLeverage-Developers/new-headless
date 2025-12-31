// hooks/useShiftStyle.ts
import { useCallback } from 'react';

export type UseShiftStyleParams = {
    offsetByKey: Record<string, number>;
    draggingKey: string | null;
    disableShiftAnimationRef: React.MutableRefObject<boolean>;
};

export type UseShiftStyleResult = {
    getShiftStyle: (colKey: string) => React.CSSProperties;
};

export const useShiftStyle = ({
    offsetByKey,
    draggingKey,
    disableShiftAnimationRef,
}: UseShiftStyleParams): UseShiftStyleResult => {
    const getShiftStyle = useCallback(
        (colKey: string): React.CSSProperties => {
            const dx = offsetByKey[colKey] ?? 0;

            const transition = disableShiftAnimationRef.current
                ? 'none'
                : draggingKey
                ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 240ms ease';

            return { transform: `translateX(${dx}px)`, transition, willChange: 'transform' };
        },
        [offsetByKey, draggingKey, disableShiftAnimationRef]
    );

    return { getShiftStyle };
};
