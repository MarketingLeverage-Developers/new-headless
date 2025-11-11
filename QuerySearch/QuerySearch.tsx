import * as React from 'react';

export type QuerySearchContextType<T> = {
    query: string;
    setQuery: (q: string, options?: { isSync?: boolean }) => void;
    label: string;
    data: T[];
    isSync: boolean;
};

const QueryContext = React.createContext<QuerySearchContextType<any> | null>(null);

export type QuerySearchProps<T> = React.PropsWithChildren<{
    label: string;
    data: T[];
    defaultQuery?: string;
}>;

export const QuerySearch = <T,>({ children, label, data, defaultQuery = '' }: QuerySearchProps<T>) => {
    const [query, setQueryState] = React.useState(defaultQuery);
    const [isSync, setIsSync] = React.useState(false);

    const setQuery = React.useCallback((q: string, options?: { isSync?: boolean }) => {
        setQueryState(q);
        setIsSync(options?.isSync ?? false);
    }, []);

    const value = React.useMemo(() => ({ query, setQuery, label, data, isSync }), [query, label, data, isSync]);

    return <QueryContext.Provider value={value}>{children}</QueryContext.Provider>;
};

export const useQuerySearch = <T,>() => {
    const ctx = React.useContext(QueryContext);
    if (!ctx) throw new Error('useQuerySearch must be used within <QueryProvider>');
    return ctx as QuerySearchContextType<T>;
};
