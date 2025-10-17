import React, { createContext, useContext, useEffect, useState } from 'react';
import { Backdrop, Close, Content, Trigger } from './components';

type ModalContextType = {
    modalValue: boolean; // 현재 열림 상태
    openModal: () => void; // 열기
    closeModal: () => void; // 닫기
};

const ModalContext = createContext<ModalContextType>({
    modalValue: false,
    openModal: () => {},
    closeModal: () => {},
});

// ✅ 컨트롤드/언컨트롤드 지원 Props
type ModalProps = {
    children: React.ReactNode;
    defaultValue?: boolean; // 언컨트롤드 초기값 (마운트 시 1회만 사용)
    value?: boolean; // 컨트롤드 값 (주어지면 컨트롤드)
    onChange?: (open: boolean) => void; // 상태 변경 알림(양쪽 공용)
    lockBodyScroll?: boolean; // 모달 열릴 때 body 스크롤 잠금 (기본 true)
    closeOnEsc?: boolean; // ESC로 닫기 (기본 true)
    enterAction?: () => void;
};

// 단일 컴포넌트(베이스 분리 X)
type ModalComponent = React.FC<ModalProps> & {
    Trigger: typeof Trigger;
    Backdrop: typeof Backdrop;
    Close: typeof Close;
    Content: typeof Content;
};

// --- 줄바꿈/멀티라인 감지 유틸 ---
const isMultilineTarget = (el: HTMLElement | null) => {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    // ARIA 멀티라인(커스텀 에디터들이 자주 씀)
    const role = el.getAttribute('role');
    const ariaMultiline = el.getAttribute('aria-multiline');
    if (role === 'textbox' && ariaMultiline === 'true') return true;
    return false;
};

// IME/멀티라인/조합키 등으로 "줄바꿈 의도"인지 판단
const isNewlineIntent = (e: KeyboardEvent) => {
    // 일부 브라우저에서만 존재
    if (e.isComposing) return true; // 조합 입력 중엔 보내지 않음
    const target = e.target as HTMLElement | null;
    if (isMultilineTarget(target)) return true; // textarea, contenteditable 등
    if (e.shiftKey || e.altKey) return true; // Shift+Enter / Alt+Enter는 줄바꿈 패턴
    return false;
};

const Modal = (({
    children,
    defaultValue = false,
    value,
    onChange,
    lockBodyScroll = true,
    closeOnEsc = true,
    enterAction,
}: ModalProps) => {
    // 언컨트롤드 내부 상태
    const [internalValue, setInternalValue] = useState<boolean>(defaultValue);

    // 컨트롤드 여부
    const isControlled = value !== undefined;

    // 실제 노출 값(컨트롤드면 value, 언컨트롤드면 내부 상태)
    const currentOpen = (isControlled ? value : internalValue) as boolean;

    // 상태 변경 함수 (심플: 메모화 X)
    const setOpen = (next: boolean) => {
        if (isControlled) {
            onChange?.(next);
        } else {
            setInternalValue(next);
            onChange?.(next);
        }
    };

    const openModal = () => setOpen(true);
    const closeModal = () => setOpen(false);

    // 모달 열림/닫힘에 따른 body 스크롤 잠금 처리
    useEffect(() => {
        if (!lockBodyScroll) return;
        if (typeof document === 'undefined') return; // SSR 안전
        const { body } = document;
        const prevOverflow = body.style.overflow;
        if (currentOpen) body.style.overflow = 'hidden';
        else body.style.overflow = prevOverflow || '';
        return () => {
            body.style.overflow = prevOverflow || '';
        };
    }, [currentOpen, lockBodyScroll]);

    useEffect(() => {
        if (!currentOpen) return;
        if (typeof window === 'undefined') return; // SSR 안전

        const onKeyDown = (e: KeyboardEvent) => {
            // ESC로 닫기
            if (closeOnEsc && (e.key === 'Escape' || e.code === 'Escape')) {
                setOpen(false);
                return;
            }
            // Enter 액션 (단일)
            if (!enterAction) return;
            const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
            if (!isEnter) return;
            if (isNewlineIntent(e)) return;

            e.preventDefault();
            e.stopPropagation();

            // 사용자 정의 동작
            enterAction();
            setOpen(false);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [currentOpen, closeOnEsc, enterAction]);

    return (
        <ModalContext.Provider
            value={{
                modalValue: currentOpen,
                openModal,
                closeModal,
            }}
        >
            {children}
        </ModalContext.Provider>
    );
}) as ModalComponent;

// 훅: 모달 컨텍스트 사용
export const useModal = () => useContext(ModalContext);

// 정적 서브컴포넌트 부착 (Compound API)
Modal.Trigger = Trigger;
Modal.Backdrop = Backdrop;
Modal.Close = Close;
Modal.Content = Content;

export default Modal;
