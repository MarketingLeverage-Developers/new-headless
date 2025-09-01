import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../Dropdown.module.scss';
import { useDropdown } from '../../Dropdown';

type Placement =
    | 'bottom-start'
    | 'bottom-end'
    | 'top-start'
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

const getPortalRoot = () => {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('dropdown-portal-root') as HTMLDivElement | null;
    if (!el) {
        el = document.createElement('div');
        el.id = 'dropdown-portal-root';
        Object.assign(el.style, {
            position: 'fixed',
            inset: '0',
            width: '0',
            height: '0',
            overflow: 'visible',
            zIndex: '9999',
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

    const base = (pl: Placement) => {
        if (pl.startsWith('bottom')) {
            top = anchor.bottom + offset;
            left = pl.endsWith('start') ? anchor.left : anchor.right - menu.width;
        } else if (pl.startsWith('top')) {
            top = anchor.top - menu.height - offset;
            left = pl.endsWith('start') ? anchor.left : anchor.right - menu.width;
        } else if (pl.startsWith('right')) {
            left = anchor.right + offset;
            top = pl.endsWith('start') ? anchor.top : anchor.bottom - menu.height;
        } else {
            left = anchor.left - menu.width - offset;
            top = pl.endsWith('start') ? anchor.top : anchor.bottom - menu.height;
        }
    };

    const fits = (t: number, l: number) =>
        t >= padding &&
        l >= padding &&
        t + menu.height <= viewport.vh - padding &&
        l + menu.width <= viewport.vw - padding;

    base(placement);
    if (!fits(top, left)) {
        if (placement.startsWith('bottom')) {
            const alt = (placement.endsWith('start') ? 'top-start' : 'top-end') as Placement;
            base(alt);
            if (fits(top, left)) finalPlacement = alt;
        } else if (placement.startsWith('top')) {
            const alt = (placement.endsWith('start') ? 'bottom-start' : 'bottom-end') as Placement;
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
        setPortalRoot(getPortalRoot());
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
            zIndex: 1000,
            ...styleProp,
        });
    }, [anchorRef, collisionPadding, matchTriggerWidth, offset, placement, portalRoot, styleProp]);

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
