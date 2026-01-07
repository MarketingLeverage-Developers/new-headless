// src/shared/headless/AirTable/hooks/usePinnedColumnControl.ts

import { useAirTableContext } from '../AirTable';
import { useCallback } from 'react';

export const usePinnedColumnControl = <T>() => {
    const { state } = useAirTableContext<T>();
    const { allLeafColumns, allLeafKeys, pinnedColumnKeys, setPinnedColumnKeys } = state;

    /** ✅ 모두 고정 */
    const allOn = useCallback(() => {
        setPinnedColumnKeys(allLeafKeys);
    }, [setPinnedColumnKeys, allLeafKeys]);

    /** ✅ 모두 고정 해제 */
    const allOff = useCallback(() => {
        setPinnedColumnKeys([]); // ✅ pinned는 0개여도 괜찮음
    }, [setPinnedColumnKeys]);

    return {
        allLeafColumns,
        allLeafKeys,
        pinnedColumnKeys,
        setPinnedColumnKeys,
        allOn,
        allOff,
    };
};
