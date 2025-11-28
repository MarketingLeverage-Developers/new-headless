import React from 'react';

// 기본 th 셀
export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ ...props }) => <th {...props} />;
