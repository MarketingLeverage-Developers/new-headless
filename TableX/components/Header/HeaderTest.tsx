import React from 'react';
import styles from './Header.module.scss';
import Table from '../../Table';

const HeaderTest = ({ ...props }: React.ComponentProps<typeof Table.Header>) => (
    <Table.Header {...props} className={styles.Header} />
);

export default HeaderTest;
