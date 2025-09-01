import React from 'react';
import classNames from 'classnames';
import styles from './Backdrop.module.scss';
import { useModal } from '../../Modal';

type BackdropProps = React.HTMLAttributes<HTMLDivElement>;

export const Backdrop = (props: BackdropProps) => {
    const { modalValue, closeModal } = useModal();

    const backdropStyle = classNames(props.className, styles.Backdrop, {
        [styles.Open]: modalValue, // dropdownValue가 true일 때 Open 클래스 적용
        [styles.Closed]: !modalValue, // dropdownValue가 false일 때 Closed 클래스 적용
    });

    return <div {...props} className={backdropStyle} onClick={() => closeModal()} />;
};
