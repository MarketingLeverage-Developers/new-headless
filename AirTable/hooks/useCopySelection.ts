import { useEffect } from 'react';

export const useCopySelection = ({
    stateRows,
    baseOrder,
    getRange,
    draggingKey,
}: {
    stateRows: { key: string }[];
    baseOrder: string[];
    getRange: () => { top: number; bottom: number; left: number; right: number } | null;
    draggingKey: string | null;
}) => {
    useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            const r = getRange();
            if (!r) return;
            if (draggingKey) return;

            const tsvRows: string[] = [];

            for (let ri = r.top; ri <= r.bottom; ri += 1) {
                const row = stateRows[ri];
                if (!row) continue;

                const line: string[] = [];

                for (let ci = r.left; ci <= r.right; ci += 1) {
                    const colKey = baseOrder[ci];
                    const id = `__cell_${row.key}_${colKey}`;
                    const el = document.getElementById(id);
                    const text = el?.textContent ?? '';
                    line.push(text.replace(/\n/g, ' '));
                }

                tsvRows.push(line.join('\t'));
            }

            const tsv = tsvRows.join('\n');
            e.clipboardData?.setData('text/plain', tsv);
            e.preventDefault();
        };

        window.addEventListener('copy', handleCopy);
        return () => window.removeEventListener('copy', handleCopy);
    }, [stateRows, baseOrder, getRange, draggingKey]);
};
