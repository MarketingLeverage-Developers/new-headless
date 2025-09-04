import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

type PortalProps = {
    children: React.ReactNode;
};

const Portal = ({ children }: PortalProps) => {
    const portalRoot = document.getElementById('root');
    const portalElement = useRef(document.createElement('div')); // useRef로 portalElement 관리

    useEffect(() => {
        if (portalRoot) {
            portalRoot.appendChild(portalElement.current); // 현재 portalElement를 추가
        }

        return () => {
            if (portalRoot) {
                portalRoot.removeChild(portalElement.current); // 클린업 시 현재 portalElement 제거
            }
        };
    }, [portalRoot]);

    return portalRoot ? ReactDOM.createPortal(children, portalElement.current) : null;
};

export default Portal;
