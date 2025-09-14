import * as React from 'react';

export type QuerySearchContextType<T> = {
    query: string;
    setQuery: (q: string) => void;
    label: string;
    data: T[];
};

const QueryContext = React.createContext<QuerySearchContextType<any> | null>(null);

export type QuerySearchProps<T> = React.PropsWithChildren<{
    label: string;
    data: T[];
    defaultQuery?: string;
}>;

export const QuerySearch = <T,>({ children, label, data, defaultQuery = '' }: QuerySearchProps<T>) => {
    const [query, setQuery] = React.useState(defaultQuery);

    const value = React.useMemo(() => ({ query, setQuery, label, data }), [query, label, data]);

    return <QueryContext.Provider value={value}>{children}</QueryContext.Provider>;
};

export const useQuerySearch = <T,>() => {
    const ctx = React.useContext(QueryContext);
    if (!ctx) throw new Error('useQuerySearch must be used within <QueryProvider>');
    return ctx as QuerySearchContextType<T>;
};
