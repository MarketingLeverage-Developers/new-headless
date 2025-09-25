import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
};

// -----------------------
// 바디 스크롤 락 유틸 (파일 내부, 훅 분리 X)
// 기능: iOS 포함 모든 환경에서 배경 스크롤 완전 고정 + 복원
// -----------------------
type SavedStyles = {
    bodyOverflow: string;
    bodyPosition: string;
    bodyTop: string;
    bodyLeft: string;
    bodyRight: string;
    bodyWidth: string;
    bodyPaddingRight: string;
    htmlOverflow: string;
};

let __lockCount = 0;
let __savedStyles: SavedStyles | null = null;
let __savedScrollY = 0;

const lockBody = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const body = document.body;
    const html = document.documentElement;

    if (__lockCount === 0) {
        __savedScrollY = window.scrollY || window.pageYOffset || 0;

        __savedStyles = {
            bodyOverflow: body.style.overflow,
            bodyPosition: body.style.position,
            bodyTop: body.style.top,
            bodyLeft: body.style.left,
            bodyRight: body.style.right,
            bodyWidth: body.style.width,
            bodyPaddingRight: body.style.paddingRight,
            htmlOverflow: html.style.overflow,
        };

        // 데스크탑에서 스크롤바 사라질 때 레이아웃 점프 방지
        const scrollbarComp = window.innerWidth - html.clientWidth;
        if (scrollbarComp > 0) {
            body.style.paddingRight = `${scrollbarComp}px`;
        }

        // iOS 포함 확실한 고정
        body.style.position = 'fixed';
        body.style.top = `-${__savedScrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';
    }

    __lockCount += 1;
};

const unlockBody = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const body = document.body;
    const html = document.documentElement;

    if (__lockCount > 0) __lockCount -= 1;
    if (__lockCount > 0) return; // 다른 모달이 아직 열려있음

    if (__savedStyles) {
        body.style.position = __savedStyles.bodyPosition;
        body.style.top = __savedStyles.bodyTop;
        body.style.left = __savedStyles.bodyLeft;
        body.style.right = __savedStyles.bodyRight;
        body.style.width = __savedStyles.bodyWidth;
        body.style.overflow = __savedStyles.bodyOverflow;
        body.style.paddingRight = __savedStyles.bodyPaddingRight;
        html.style.overflow = __savedStyles.htmlOverflow;
        __savedStyles = null;
    }

    // 잠그기 전 스크롤 위치로 정확하게 복원
    window.scrollTo(0, __savedScrollY);
};

// 단일 컴포넌트(베이스 분리 X)
type ModalComponent = React.FC<ModalProps> & {
    Trigger: typeof Trigger;
    Backdrop: typeof Backdrop;
    Close: typeof Close;
    Content: typeof Content;
};

const Modal = (({ children, defaultValue = false, value, onChange, lockBodyScroll = true }: ModalProps) => {
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

    // ✨ iOS 안전한 바디 스크롤 락: overflow 대신 position:fixed 방식 + 복원
    const prevAppliedRef = useRef<boolean>(false);
    useEffect(() => {
        if (!lockBodyScroll) return;
        if (typeof document === 'undefined') return;

        if (currentOpen && !prevAppliedRef.current) {
            lockBody();
            prevAppliedRef.current = true;
        } else if (!currentOpen && prevAppliedRef.current) {
            unlockBody();
            prevAppliedRef.current = false;
        }

        return () => {
            // 컴포넌트 언마운트 시 열려있었다면 풀기
            if (prevAppliedRef.current) {
                unlockBody();
                prevAppliedRef.current = false;
            }
        };
    }, [currentOpen, lockBodyScroll]);

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
