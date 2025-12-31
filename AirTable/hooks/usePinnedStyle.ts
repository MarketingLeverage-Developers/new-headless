import { useCallback } from 'react';

export const usePinnedStyle = ({
    pinnedColumnKeys,
    baseXByKey,
}: {
    pinnedColumnKeys: string[];
    baseXByKey: Record<string, number>;
}) => {
    const getPinnedStyle = useCallback(
        (colKey: string, bg?: string, options?: { isHeader?: boolean }): React.CSSProperties => {
            if (!pinnedColumnKeys.includes(colKey)) return {};

            const isHeader = options?.isHeader === true;
            const left = baseXByKey[colKey] ?? 0;

            return {
                position: 'sticky',
                left,
                zIndex: 50,
                background: bg ?? '#fff',
                borderRight: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '6px 0 10px rgba(0,0,0,0.06)',
                backgroundClip: 'padding-box',
                willChange: 'transform',
                color: isHeader ? '#fff' : undefined,
            };
        },
        [pinnedColumnKeys, baseXByKey]
    );

    return { getPinnedStyle };
};
