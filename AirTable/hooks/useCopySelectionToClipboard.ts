import { useEffect } from 'react';

export type CopySelectionParams = {
    getRange: () => { top: number; bottom: number; left: number; right: number } | null;
    draggingKey: string | null;
    rows: { key: string }[];
    baseOrder: string[];
};

export const useCopySelectionToClipboard = ({ getRange, draggingKey, rows, baseOrder }: CopySelectionParams) => {
    useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            const r = getRange();
            if (!r) return;
            if (draggingKey) return;

            const tsvRows: string[] = [];

            for (let ri = r.top; ri <= r.bottom; ri += 1) {
                const row = rows[ri];
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
    }, [rows, baseOrder, getRange, draggingKey]);
};
