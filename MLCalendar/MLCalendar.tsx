'use client';

import type React from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

// --- Types ---
export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export type CalendarEvent = {
    id: string;
    title: string;
    start: Date | string;
    end?: Date | string;
    allDay?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    extendedProps?: Record<string, unknown>;
};

type MLCalendarContextType = {
    // 상태
    view: CalendarView;
    currentDate: Date;
    events: CalendarEvent[];
    selectedEvent: CalendarEvent | null;
    isLoading: boolean;

    // 액션
    setView: (view: CalendarView) => void;
    setCurrentDate: (date: Date) => void;
    setEvents: (events: CalendarEvent[]) => void;
    addEvent: (event: CalendarEvent) => void;
    updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
    removeEvent: (id: string) => void;
    selectEvent: (event: CalendarEvent | null) => void;
    setIsLoading: (loading: boolean) => void;

    // 네비게이션
    goToToday: () => void;
    goToPrev: () => void;
    goToNext: () => void;
};

const MLCalendarContext = createContext<MLCalendarContextType | null>(null);

// --- Props ---
type MLCalendarProps = {
    children: React.ReactNode;
    initialView?: CalendarView;
    initialDate?: Date;
    initialEvents?: CalendarEvent[];
    onViewChange?: (view: CalendarView) => void;
    onDateChange?: (date: Date) => void;
    onEventSelect?: (event: CalendarEvent | null) => void;
    onEventsChange?: (events: CalendarEvent[]) => void;
};

// --- Provider Component ---
const MLCalendarProvider: React.FC<MLCalendarProps> = ({
    children,
    initialView = 'dayGridMonth',
    initialDate,
    initialEvents = [],
    onViewChange,
    onDateChange,
    onEventSelect,
    onEventsChange,
}) => {
    const [view, setViewState] = useState<CalendarView>(initialView);
    const [currentDate, setCurrentDateState] = useState<Date>(initialDate ?? new Date());
    const [events, setEventsState] = useState<CalendarEvent[]>(initialEvents);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setView = useCallback(
        (newView: CalendarView) => {
            setViewState(newView);
            onViewChange?.(newView);
        },
        [onViewChange]
    );

    const setCurrentDate = useCallback(
        (date: Date) => {
            setCurrentDateState(date);
            onDateChange?.(date);
        },
        [onDateChange]
    );

    const setEvents = useCallback(
        (newEvents: CalendarEvent[]) => {
            setEventsState(newEvents);
            onEventsChange?.(newEvents);
        },
        [onEventsChange]
    );

    const addEvent = useCallback(
        (event: CalendarEvent) => {
            setEventsState((prev) => {
                const updated = [...prev, event];
                onEventsChange?.(updated);
                return updated;
            });
        },
        [onEventsChange]
    );

    const updateEvent = useCallback(
        (id: string, eventData: Partial<CalendarEvent>) => {
            setEventsState((prev) => {
                const updated = prev.map((e) => (e.id === id ? { ...e, ...eventData } : e));
                onEventsChange?.(updated);
                return updated;
            });
        },
        [onEventsChange]
    );

    const removeEvent = useCallback(
        (id: string) => {
            setEventsState((prev) => {
                const updated = prev.filter((e) => e.id !== id);
                onEventsChange?.(updated);
                return updated;
            });
        },
        [onEventsChange]
    );

    const selectEvent = useCallback(
        (event: CalendarEvent | null) => {
            setSelectedEvent(event);
            onEventSelect?.(event);
        },
        [onEventSelect]
    );

    const goToToday = useCallback(() => {
        setCurrentDate(new Date());
    }, [setCurrentDate]);

    const goToPrev = useCallback(() => {
        const newDate = new Date(currentDate);
        switch (view) {
            case 'dayGridMonth':
                newDate.setMonth(newDate.getMonth() - 1);
                break;
            case 'timeGridWeek':
            case 'listWeek':
                newDate.setDate(newDate.getDate() - 7);
                break;
            case 'timeGridDay':
                newDate.setDate(newDate.getDate() - 1);
                break;
        }
        setCurrentDate(newDate);
    }, [currentDate, view, setCurrentDate]);

    const goToNext = useCallback(() => {
        const newDate = new Date(currentDate);
        switch (view) {
            case 'dayGridMonth':
                newDate.setMonth(newDate.getMonth() + 1);
                break;
            case 'timeGridWeek':
            case 'listWeek':
                newDate.setDate(newDate.getDate() + 7);
                break;
            case 'timeGridDay':
                newDate.setDate(newDate.getDate() + 1);
                break;
        }
        setCurrentDate(newDate);
    }, [currentDate, view, setCurrentDate]);

    const contextValue = useMemo<MLCalendarContextType>(
        () => ({
            view,
            currentDate,
            events,
            selectedEvent,
            isLoading,
            setView,
            setCurrentDate,
            setEvents,
            addEvent,
            updateEvent,
            removeEvent,
            selectEvent,
            setIsLoading,
            goToToday,
            goToPrev,
            goToNext,
        }),
        [
            view,
            currentDate,
            events,
            selectedEvent,
            isLoading,
            setView,
            setCurrentDate,
            setEvents,
            addEvent,
            updateEvent,
            removeEvent,
            selectEvent,
            goToToday,
            goToPrev,
            goToNext,
        ]
    );

    return <MLCalendarContext.Provider value={contextValue}>{children}</MLCalendarContext.Provider>;
};

// --- Hook ---
export const useMLCalendar = () => {
    const context = useContext(MLCalendarContext);
    if (!context) {
        throw new Error('useMLCalendar must be used within MLCalendarProvider');
    }
    return context;
};

export default MLCalendarProvider;
