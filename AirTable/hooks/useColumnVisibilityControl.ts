import { useAirTableContext } from '../AirTable';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Rect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

type Options = {
    portalId?: string;
};

export const useColumnVisibilityControl = <T>({ portalId }: Options) => {
    const { state } = useAirTableContext<T>();
    const { allLeafColumns, allLeafKeys, visibleColumnKeys, setVisibleColumnKeys } = state;

    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState<Rect | null>(null);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

    // ✅ portal target은 "나중에 DOM에 생겨도" 잡히게 해야 함
    useLayoutEffect(() => {
        if (!portalId) {
            setPortalEl(null);
            return;
        }
        if (typeof window === 'undefined') return;

        const findPortal = () => {
            const el = document.getElementById(portalId);
            if (el) {
                setPortalEl(el);
                return true;
            }
            return false;
        };

        // 1) 지금 바로 찾기
        if (findPortal()) return;

        // 2) 없으면 생길 때까지 관찰
        const observer = new MutationObserver(() => {
            if (findPortal()) observer.disconnect();
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [portalId]);

    const close = useCallback(() => {
        setOpen(false);
    }, []);

    const toggleOpen = useCallback(() => {
        setOpen((v) => !v);
    }, []);

    const updateRect = useCallback(() => {
        const btn = triggerRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        setAnchorRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        });
    }, []);

    // ✅ open 되면 rect 계산
    useEffect(() => {
        if (!open) return;
        updateRect();
    }, [open, updateRect]);

    // ✅ 스크롤/리사이즈 시 rect 갱신
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

    // ✅ 바깥 클릭 닫기
    useEffect(() => {
        if (!open) return;

        const handleOutside = (e: MouseEvent) => {
            const target = e.target as Node;

            if (wrapRef.current?.contains(target)) return;
            if (dropdownRef.current?.contains(target)) return;

            close();
        };

        window.addEventListener('mousedown', handleOutside);
        return () => window.removeEventListener('mousedown', handleOutside);
    }, [open, close]);

    // ✅ 컬럼 on/off
    const toggleColumn = useCallback(
        (key: string) => {
            const has = visibleColumnKeys.includes(key);
            const next = has ? visibleColumnKeys.filter((k) => k !== key) : [...visibleColumnKeys, key];
            if (next.length === 0) return;
            setVisibleColumnKeys(next);
        },
        [visibleColumnKeys, setVisibleColumnKeys]
    );

    const allOn = useCallback(() => {
        setVisibleColumnKeys(allLeafKeys);
    }, [setVisibleColumnKeys, allLeafKeys]);

    const allOff = useCallback(() => {
        if (allLeafKeys.length === 0) return;
        setVisibleColumnKeys([allLeafKeys[0]]);
    }, [setVisibleColumnKeys, allLeafKeys]);

    return {
        // refs
        wrapRef,
        triggerRef,
        dropdownRef,

        // portal
        portalEl,

        // state
        open,
        toggleOpen,
        close,

        // position
        anchorRect,

        // columns
        allLeafColumns,
        visibleColumnKeys,
        toggleColumn,
        allOn,
        allOff,
    };
};
