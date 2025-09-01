import { useRowDetails } from '../Details/Details';

export const Toggle: React.FC<{
    openLabel?: string;
    closedLabel?: string;
    hideIfNoHidden?: boolean;
}> = ({ openLabel = '접기', closedLabel = '열기', hideIfNoHidden = true }) => {
    const { opened, hasHidden, toggle } = useRowDetails();
    if (hideIfNoHidden && !hasHidden) return null;
    return (
        <button type="button" onClick={toggle}>
            {opened ? openLabel : closedLabel}
        </button>
    );
};
