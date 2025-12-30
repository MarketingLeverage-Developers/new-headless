export const getPinnedStyle = (
    colKey: string,
    pinnedColumnKeys: string[],
    baseXByKey: Record<string, number>
): React.CSSProperties | null => {
    const pinnedIndex = pinnedColumnKeys.indexOf(colKey);
    if (pinnedIndex === -1) return null;

    return {
        position: 'sticky',
        left: baseXByKey[colKey] ?? 0,
        zIndex: 60 + (pinnedColumnKeys.length - pinnedIndex),
        background: '#fff',
        boxShadow: pinnedIndex === pinnedColumnKeys.length - 1 ? '2px 0 0 rgba(0,0,0,0.06)' : undefined,
    };
};
