import React, { useRef } from 'react';
import { useModal } from '../../Modal';
import styles from './Content.module.scss';
import classNames from 'classnames';
type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
};

export const Content = ({ children, ...props }: ContentProps) => {
    const { modalValue } = useModal();
    const containerRef = useRef<HTMLDivElement>(null);

    const combinedStyle = classNames(props.className, styles.Content, {
        [styles.Open]: modalValue, // dropdownValue가 true일 때 Open 클래스 적용
        [styles.Closed]: !modalValue, // dropdownValue가 false일 때 Closed 클래스 적용
    });

    return (
        <>
            <div ref={containerRef} {...props} className={combinedStyle}>
                {children}
            </div>
        </>
    );
};
