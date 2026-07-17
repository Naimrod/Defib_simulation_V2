import { useRef, useCallback } from "react";


export const startLog = () => {

    const logRef = useRef<string>("");
    const lastMessageLog = useRef(['']);

    if (!logRef.current && lastMessageLog.current) {
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        logRef.current = `Log du ${dateStr} ${time} :\n-------------------\n`;
        lastMessageLog.current.push(`Log du ${dateStr} ${time} :\n-------------------\n`);
    }

    const appendToLog = useCallback((message: string) => {
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        logRef.current += `[${time}] ${message}\n\n`;
        if (lastMessageLog.current.length < 5) {
            lastMessageLog.current.push(`[${time}] ${message}\n\n`);
            console.log(lastMessageLog)
        } else {
            lastMessageLog.current.reverse()
            lastMessageLog.current.pop()
            lastMessageLog.current.reverse()
            lastMessageLog.current.push(`[${time}] ${message}\n\n`);
            lastMessageLog.current.reverse()
            console.log(lastMessageLog)
        }
    }, []);

    const downloadLogFile = useCallback(() => {

        const blob = new Blob([logRef.current], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const link = document.createElement("a");
        link.href = url;
        link.download = `LOG du ${dateStr}; ${time}.txt`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const resetLog = useCallback(() => {
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
        logRef.current = `Log du ${dateStr} :\n-------------------\n`;
        while (lastMessageLog.current.length !== 0) {
            lastMessageLog.current.pop()
        }
        lastMessageLog.current.push(`Log du ${dateStr} :\n-------------------\n`)
    }, [])
    return { appendToLog, downloadLogFile, resetLog, lastMessageLog, logRef};
}