import React, { useMemo } from 'react';
import type { Column } from '@/shared/headless/TableX/Table';
import { useTableContext } from '@/shared/headless/TableX/Table';
import Dropdown from '@/shared/headless/Dropdown/Dropdown';
import ManySelect from '@/shared/headless/ManySelect/ManySelect';
import classNames from 'classnames';

type ColumnSelectBoxProps = {
    className?: string; // 전체 래퍼
    triggerClassName?: string;
    contentClassName?: string;
    itemClassName?: string;
    checkboxWrapperClassName?: string;
    checkboxWrapperCheckedClassName?: string;
    labelClassName?: string;
    itemNode?: (label: string, checked: boolean) => React.ReactNode;
};

const ColumnSelectBox = <T,>({
    className,
    triggerClassName,
    contentClassName,
    itemClassName,
    checkboxWrapperClassName,
    checkboxWrapperCheckedClassName,
    labelClassName,
    itemNode,
}: ColumnSelectBoxProps) => {
    // ✅ Table 컨텍스트에서 컬럼 + 상태 직접 가져오기
    const { state, columns } = useTableContext<T>();
    const { visibleColumnKeys, setVisibleColumnKeys, columnOrder } = state;

    // ✅ columnOrder 기준으로 컬럼 정렬 (드래그앤드롭 결과 반영)
    const orderedColumns = useMemo(() => {
        const colArray = columns as Column<T>[];

        const map = new Map<string, Column<T>>();
        colArray.forEach((c) => {
            map.set(String(c.key), c);
        });

        const result: Column<T>[] = [];

        // 1) columnOrder 순서대로 먼저 push
        columnOrder.forEach((key) => {
            const col = map.get(String(key));
            if (col) result.push(col);
        });

        // 2) 혹시 order에 없는 컬럼 있으면 뒤에 추가
        colArray.forEach((c) => {
            const k = String(c.key);
            if (!columnOrder.includes(k)) {
                result.push(c);
            }
        });

        return result;
    }, [columns, columnOrder]);

    const checkboxClassName = (key: string) =>
        classNames(checkboxWrapperClassName, visibleColumnKeys.includes(key) && checkboxWrapperCheckedClassName);

    return (
        <div className={className}>
            <Dropdown>
                <ManySelect
                    value={visibleColumnKeys}
                    onChange={(next) => {
                        // ManySelect 에서 넘어온 string[] 을 그대로 visibleColumnKeys 로 반영
                        setVisibleColumnKeys(next);
                    }}
                >
                    <Dropdown.Content className={contentClassName} offset={8} placement="bottom-start">
                        {orderedColumns.map((item) => {
                            const key = String(item.key);

                            return (
                                <ManySelect.Item key={key} value={key} className={classNames(itemClassName)}>
                                    {/* <div className={checkboxClassName(key)} />
                                    <span className={labelClassName}>{item.label ?? key}</span> */}
                                    {itemNode?.(item.label ?? item.key, visibleColumnKeys.includes(key))}
                                </ManySelect.Item>
                            );
                        })}
                    </Dropdown.Content>

                    <Dropdown.Trigger className={triggerClassName}>테이블 컬럼</Dropdown.Trigger>
                </ManySelect>
            </Dropdown>
        </div>
    );
};

export default ColumnSelectBox;
