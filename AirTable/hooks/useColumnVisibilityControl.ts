// src/shared/headless/AirTable/hooks/useColumnVisibilityControl.ts

import { useAirTableContext } from '../AirTable';
import { useCallback } from 'react';

export const useColumnVisibilityControl = <T>() => {
    const { state } = useAirTableContext<T>();
    const { allLeafColumns, allLeafKeys, visibleColumnKeys, setVisibleColumnKeys } = state;

    /** ✅ 모두 켜기 */
    const allOn = useCallback(() => {
        setVisibleColumnKeys(allLeafKeys);
    }, [setVisibleColumnKeys, allLeafKeys]);

    /** ✅ 모두 끄기 */
    const allOff = useCallback(() => {
        if (allLeafKeys.length === 0) return;
        setVisibleColumnKeys([allLeafKeys[0]]);
    }, [setVisibleColumnKeys, allLeafKeys]);

    return {
        allLeafColumns,
        allLeafKeys,
        visibleColumnKeys,
        setVisibleColumnKeys,
        allOn,
        allOff,
    };
};
