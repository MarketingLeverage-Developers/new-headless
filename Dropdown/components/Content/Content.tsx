import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../Dropdown.module.scss';
import { useDropdown } from '../../Dropdown';

type Placement =
    | 'bottom-start'
    | 'bottom-center' // ✅ 추가
    | 'bottom-end'
    | 'top-start'
    | 'top-center' // ✅ 추가
    | 'top-end'
    | 'right-start'
    | 'right-end'
    | 'left-start'
    | 'left-end';

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    placement?: Placement;
    offset?: number;
    matchTriggerWidth?: boolean;
    collisionPadding?: number;
};

type PortalLayer = 'base' | 'modal';

const resolvePortalLayer = (anchorEl: HTMLElement | null): PortalLayer => {
    if (!anchorEl) return 'base';
    // ✅ Modal(Content) 내부에서 열린 dropdown은 modal 레이어 위에 떠야 한다.
    // - 그렇지 않으면 포탈이 body에 붙는 구조상 modal(z-index) 뒤로 숨어서 "안 열리는" 것처럼 보일 수 있음.
    // - BottomSheet 등은 aria-modal="true"로도 판단
    const inModal = Boolean(anchorEl.closest('[data-modal-content="true"], [aria-modal="true"]'));
    return inModal ? 'modal' : 'base';
};

const getPortalRoot = (layer: PortalLayer) => {
    if (typeof document === 'undefined') return null;
    const id = layer === 'modal' ? 'dropdown-portal-root-modal' : 'dropdown-portal-root';
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        Object.assign(el.style, {
            position: 'fixed',
            inset: '0',
            width: '0',
            height: '0',
            overflow: 'visible',
            // ✅ Dropdown portal stacking:
            // - base: page chrome 위, modal/backdrop 아래
            // - modal: modal content 위 (modal 내부 dropdown이 보이도록)
            zIndex:
                layer === 'modal'
                    ? 'var(--z-dropdown-portal-modal, 9002)'
                    : 'var(--z-dropdown-portal, 7000)',
        });
        document.body.appendChild(el);
    }
    return el;
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const computePosition = (
    anchor: DOMRect,
    menu: { width: number; height: number },
    viewport: { vw: number; vh: number },
    placement: Placement,
    offset: number,
    padding: number
) => {
    let top = 0;
    let left = 0;
    let finalPlacement = placement;

    // ✅ placement의 정렬(start/end/center)을 추출하는 함수
    const getAlign = (pl: Placement) => {
        if (pl.endsWith('start')) return 'start';
        if (pl.endsWith('end')) return 'end';
        return 'center';
    };

    const base = (pl: Placement) => {
        const align = getAlign(pl);

        if (pl.startsWith('bottom')) {
            // ✅ 아래 배치
            top = anchor.bottom + offset;

            if (align === 'start') left = anchor.left;
            else if (align === 'end') left = anchor.right - menu.width;
            else left = anchor.left + anchor.width / 2 - menu.width / 2; // ✅ center 계산
        } else if (pl.startsWith('top')) {
            // ✅ 위 배치
            top = anchor.top - menu.height - offset;

            if (align === 'start') left = anchor.left;
            else if (align === 'end') left = anchor.right - menu.width;
            else left = anchor.left + anchor.width / 2 - menu.width / 2; // ✅ center 계산
        } else if (pl.startsWith('right')) {
            // ✅ 오른쪽 배치
            left = anchor.right + offset;

            if (align === 'start') top = anchor.top;
            else top = anchor.bottom - menu.height; // ✅ 기존 right는 center 없음 (요청 없어서 유지)
        } else {
            // ✅ 왼쪽 배치
            left = anchor.left - menu.width - offset;

            if (align === 'start') top = anchor.top;
            else top = anchor.bottom - menu.height; // ✅ 기존 left는 center 없음 (요청 없어서 유지)
        }
    };

    const fits = (t: number, l: number) =>
        t >= padding &&
        l >= padding &&
        t + menu.height <= viewport.vh - padding &&
        l + menu.width <= viewport.vw - padding;

    base(placement);

    // ✅ 화면 밖이면 반대 방향으로 뒤집기
    if (!fits(top, left)) {
        if (placement.startsWith('bottom')) {
            // ✅ bottom -> top (start/end/center 유지)
            const alt = `top-${getAlign(placement)}` as Placement;
            base(alt);
            if (fits(top, left)) finalPlacement = alt;
        } else if (placement.startsWith('top')) {
            // ✅ top -> bottom (start/end/center 유지)
            const alt = `bottom-${getAlign(placement)}` as Placement;
            base(alt);
            if (fits(top, left)) finalPlacement = alt;
        } else if (placement.startsWith('right')) {
            const alt = (placement.endsWith('start') ? 'left-start' : 'left-end') as Placement;
            base(alt);
            if (fits(top, left)) finalPlacement = alt;
        } else {
            const alt = (placement.endsWith('start') ? 'right-start' : 'right-end') as Placement;
            base(alt);
            if (fits(top, left)) finalPlacement = alt;
        }
    }

    left = clamp(left, padding, Math.max(padding, viewport.vw - menu.width - padding));
    top = clamp(top, padding, Math.max(padding, viewport.vh - menu.height - padding));

    return { top, left, placement: finalPlacement };
};

const getFirstFocusable = (root: HTMLElement | null) => {
    if (!root) return null;
    return (
        root.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ||
        null
    );
};

const Content: React.FC<ContentProps> = ({
    children,
    placement = 'bottom-start',
    offset = 4,
    matchTriggerWidth,
    collisionPadding = 8,
    className,
    style: styleProp,
    ...rest
}) => {
    const { isOpen, close, anchorRef, menuId, lastFocusedEl } = useDropdown();

    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        // 기본은 base 레이어 포탈을 만든다. (닫힘 애니메이션/재사용을 위해 유지)
        setPortalRoot(getPortalRoot('base'));
    }, []);

    const menuRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'auto',
    });

    const recalc = useCallback(() => {
        const anchorEl = anchorRef.current;
        const menuEl = menuRef.current;
        if (!portalRoot || !anchorEl || !menuEl) return;

        const layer = resolvePortalLayer(anchorEl);

        const a = anchorEl.getBoundingClientRect();
        const w = menuEl.offsetWidth;
        const h = menuEl.offsetHeight;
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        const pos = computePosition(a, { width: w, height: h }, { vw, vh }, placement, offset, collisionPadding);

        setStyle({
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: matchTriggerWidth ? `${a.width}px` : undefined,
            visibility: 'visible',
            pointerEvents: 'auto',
            zIndex: layer === 'modal' ? 'var(--z-dropdown-modal, 9002)' : 'var(--z-dropdown, 7000)',
            ...styleProp,
        });
    }, [anchorRef, collisionPadding, matchTriggerWidth, offset, placement, portalRoot, styleProp]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const layer = resolvePortalLayer(anchorRef.current);
        const root = getPortalRoot(layer);
        if (root && root !== portalRoot) setPortalRoot(root);
    }, [isOpen, anchorRef, portalRoot]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setStyle((s) => ({ ...s, visibility: 'hidden' }));
            return;
        }
        recalc();
    }, [isOpen, recalc]);

    useEffect(() => {
        if (!isOpen) return;
        const menuEl = menuRef.current;
        const anchorEl = anchorRef.current;

        const ro = new ResizeObserver(() => {
            requestAnimationFrame(() => recalc());
        });

        if (menuEl) ro.observe(menuEl);
        if (anchorEl) ro.observe(anchorEl);

        const onResize = () => requestAnimationFrame(() => recalc());
        window.addEventListener('resize', onResize, { passive: true });

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', onResize);
        };
    }, [isOpen, recalc, anchorRef]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, close]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: Event) => {
            const menuEl = menuRef.current;
            const anchorEl = anchorRef.current;
            if (!menuEl || !anchorEl) return;

            const t = e.target as Node | null;
            if (t && (menuEl.contains(t) || anchorEl.contains(t))) return;
            close();
        };
        const opt: AddEventListenerOptions = { capture: true };
        window.addEventListener('pointerdown', handler, opt);
        return () => window.removeEventListener('pointerdown', handler, true);
    }, [isOpen, close, anchorRef]);

    useEffect(() => {
        if (!isOpen) return;
        const onScroll = (e: Event) => {
            const menuEl = menuRef.current;
            const anchorEl = anchorRef.current;
            const t = e.target as Node | null;

            if (menuEl && t && menuEl.contains(t)) return;
            if (anchorEl && t && anchorEl.contains(t)) return;
            close();
        };
        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [isOpen, close, anchorRef]);

    useEffect(() => {
        if (!isOpen) {
            if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
            else if (anchorRef.current) anchorRef.current.focus();
            return;
        }
        const el = menuRef.current;
        const focusable = getFirstFocusable(el);
        if (focusable) focusable.focus();
        else el?.focus();
    }, [isOpen, lastFocusedEl, anchorRef]);

    if (!portalRoot) return null;

    const cn = [styles.Content, isOpen ? styles.Open : styles.Closed, className].filter(Boolean).join(' ');

    return createPortal(
        <div {...rest} id={menuId} ref={menuRef} role="menu" className={cn} style={style} tabIndex={-1}>
            {children}
        </div>,
        portalRoot
    );
};

export default Content;
