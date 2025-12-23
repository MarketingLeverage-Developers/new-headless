import { useMemo } from 'react';
import { useTableContext, type Column } from '../../Table';
import type { SelectItem } from '@/shared/primitives/SearchSelect/SearchSelect';

import ManySelect, { useManySelect } from '@/shared/headless/ManySelect/ManySelect';
import Dropdown from '@/shared/headless/Dropdown/Dropdown';
import { QuerySearch, useQuerySearch } from '@/shared/headless/QuerySearch/QuerySearch';
import { useHangulSearch } from '@/shared/hooks/client/useHangulSearch';
import classNames from 'classnames';
import SectionDiver from '@/shared/primitives/SectionDiver/SectionDiver';

export type SearchColumnSelectBoxProps = {
    className?: string; // 전체 래퍼
    triggerClassName?: string;
    contentClassName?: string;
    itemClassName?: string;
    checkboxWrapperClassName?: string;
    checkboxWrapperCheckedClassName?: string;
    labelClassName?: string;
    inputClassName?: string;
    topClassName?: string;
    bottomClassName?: string;
    itemNode?: (label: string, checked: boolean) => React.ReactNode;
};

const SearchColumnSelectBox = <T,>({
    className,
    triggerClassName,
    contentClassName,
    itemClassName,
    checkboxWrapperClassName,
    checkboxWrapperCheckedClassName,
    labelClassName,
    topClassName,
    bottomClassName,
    inputClassName,
    itemNode,
}: SearchColumnSelectBoxProps) => {
    const { state, columns } = useTableContext<T>();
    const { visibleColumnKeys, setVisibleColumnKeys, columnOrder } = state;

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

    const data: SelectItem[] = orderedColumns.map((item) => ({ label: item.key ?? '', uuid: item.key ?? '' }));

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
                    <QuerySearch<SelectItem> label="" data={data}>
                        <Dropdown.Content className={contentClassName} offset={8} placement="bottom-start">
                            <SearchSelectItemList
                                itemClassName={itemClassName}
                                itemNode={itemNode}
                                visibleColumnKeys={visibleColumnKeys}
                                inputClassName={inputClassName}
                                bottomClassName={bottomClassName}
                                topClassName={topClassName}
                            />
                        </Dropdown.Content>
                        <Dropdown.Trigger className={triggerClassName}>테이블 컬럼</Dropdown.Trigger>
                    </QuerySearch>
                </ManySelect>
            </Dropdown>
        </div>
    );
};

export default SearchColumnSelectBox;

const SearchSelectItemList = ({
    itemNode,
    visibleColumnKeys,
    itemClassName,
    inputClassName,
    bottomClassName,
    topClassName,
}: {
    itemNode?: (label: string, checked: boolean) => React.ReactNode;
    visibleColumnKeys: string[];
    itemClassName?: string;
    inputClassName?: string;
    topClassName?: string;
    bottomClassName?: string;
}) => {
    const { query, data, setQuery } = useQuerySearch<SelectItem>();
    const { filtered } = useHangulSearch<SelectItem>(data, query, (it) => String(it.label ?? ''));

    const uniqueFiltered = useMemo(() => {
        const seen = new Set<string>();
        return filtered.filter((it) => {
            const id = String(it?.uuid ?? '');
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [filtered]);

    // ManySelect에서 한 번에 변경할 수 있는 API들 사용
    const { manySelectValue, changeManySelectValue, isChecked } = useManySelect();

    // “필터된 목록” 기준 전체 선택 상태
    const allSelectedOnFiltered = useMemo(() => {
        if (uniqueFiltered.length === 0) return false;
        return uniqueFiltered.every((it) => isChecked(String(it.uuid)));
    }, [uniqueFiltered, isChecked]);

    //  전체 선택/해제 버튼 핸들러 (필터된 목록 기준)
    const onToggleSelectAll = () => {
        const ids = uniqueFiltered.map((it) => String(it.uuid));

        if (ids.length === 0) return;

        if (allSelectedOnFiltered) {
            // 이미 전부 선택되어 있으면 -> 필터된 것들만 해제
            changeManySelectValue(manySelectValue.filter((v) => !ids.includes(v)));
        } else {
            // 아니면 -> 필터된 것들 모두 추가(중복 제거)
            changeManySelectValue(Array.from(new Set([...manySelectValue, ...ids])));
        }
    };

    return (
        <>
            <div className={topClassName}>
                <input
                    className={inputClassName}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    type="text"
                    placeholder="검색..."
                />

                <div onClick={onToggleSelectAll} style={{ cursor: 'pointer' }}>
                    {itemNode?.('모두 선택', allSelectedOnFiltered)}
                </div>

                <SectionDiver />
            </div>

            <div className={bottomClassName}>
                {uniqueFiltered.length === 0 && <div>결과가 없습니다</div>}

                {uniqueFiltered.map((item) => (
                    <ManySelect.Item key={item.uuid} value={String(item.uuid)} className={classNames(itemClassName)}>
                        {itemNode?.(item.label ?? String(item.uuid), isChecked(String(item.uuid)))}
                    </ManySelect.Item>
                ))}
            </div>
        </>
    );
};
