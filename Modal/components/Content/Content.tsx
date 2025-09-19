import React, { useRef } from 'react';
import { useModal } from '../../Modal';
import styles from './Content.module.scss';
import classNames from 'classnames';
import type { CSSVariables } from '@/shared/types/css/CSSVariables';
import { toCssUnit } from '@/shared/utils';
type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    width?: string | number;
    height?: string | number;
};

export const Content = ({ width = 'auto', height = 'auto', children, style, ...props }: ContentProps) => {
    const { modalValue } = useModal();

    const containerRef = useRef<HTMLDivElement>(null);

    const combinedStyle = classNames(props.className, styles.Content, {
        [styles.Open]: modalValue, // dropdownValue가 true일 때 Open 클래스 적용
        [styles.Closed]: !modalValue, // dropdownValue가 false일 때 Closed 클래스 적용
    });

    const cssVariables: CSSVariables = {
        '--width': toCssUnit(width),
        '--height': toCssUnit(height),
    };

    return (
        <>
            <div ref={containerRef} {...props} className={combinedStyle} style={{ ...cssVariables, ...style }}>
                {children}
            </div>
        </>
    );
};
