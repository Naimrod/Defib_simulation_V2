import { useRef, useEffect, useCallback } from 'react';

export const useInternalTimer = () => {
    // useRef keeps track of the value, but changing it DOES NOT trigger a re-render
    const secondsCount = useRef<number>(0);
    const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

    const startTimer = useCallback(() => {
        // Prevent multiple intervals from starting if it's already running
        if (intervalId.current !== null) return;

        intervalId.current = setInterval(() => {
            secondsCount.current += 1
            console.log(secondsCount)
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (intervalId.current !== null) {
            clearInterval(intervalId.current);
            intervalId.current = null;
        }
    }, []);

    const resetTimer = useCallback(() => {
        stopTimer();
        secondsCount.current = 0;
    }, [stopTimer]);

    // A helper to let you check the current time exactly when you need it
    const getCurrentTime = useCallback(() => secondsCount.current, []);

    // Cleanup: Ensure the timer stops if the component using this hook unmounts
    useEffect(() => {
        return () => stopTimer();
    }, [stopTimer]);

    return { startTimer, stopTimer, resetTimer, getCurrentTime };
};