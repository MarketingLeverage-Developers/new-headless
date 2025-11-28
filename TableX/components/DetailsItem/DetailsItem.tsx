import type { HTMLAttributes } from 'react';
import type { DetailsRenderer } from '../../Table';
import { DetailsList } from '../DetailsList/DetailsList';

type DetailsItemProps = {
    label: React.ReactNode;
    children: React.ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export const DetailsItem: React.FC<DetailsItemProps> = ({ label, children, ...props }: DetailsItemProps) => (
    <div {...props}>
        <div>{label}</div>
        <div>{children}</div>
    </div>
);

/* =========================
   Details Renderer Factory
   ========================= */

type CreateDetailsRendererOptions = {
    labelWidth?: number; // 기본 160px
    wrapperClassName?: string;
    wrapperStyle?: React.CSSProperties;
    itemClassName?: string;
    itemStyle?: React.CSSProperties;
};

export const createDetailsRenderer = <T,>(opts?: CreateDetailsRendererOptions): DetailsRenderer<T> => {
    const { labelWidth = 160, wrapperClassName, wrapperStyle, itemClassName, itemStyle } = opts ?? {};

    const renderer: DetailsRenderer<T> = ({ row, ri }) => (
        <DetailsList labelWidth={labelWidth} className={wrapperClassName} style={wrapperStyle}>
            {row.hiddenCells.map((hc) => (
                <DetailsItem label={hc.label} className={itemClassName} style={itemStyle}>
                    {hc.render(row.item, ri)}
                </DetailsItem>
            ))}
        </DetailsList>
    );

    return renderer;
};
