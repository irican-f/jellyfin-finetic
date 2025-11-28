import { JellyfinItem } from "@/types/jellyfin";

// Time conversion utilities
export const secondsToTicks = (seconds: number) => Math.floor(seconds * 10000000);
export const ticksToSeconds = (ticks: number) => ticks / 10000000;

// Debounce utility
export const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Subtitle processing
export const processSubtitleText = (text: string): { text: string; positionTop: boolean } => {
    const shouldPositionTop = /\{\\an8\}/.test(text);
    let processedText = text.replace(/\{[^}]+\}/g, (match) => {
        if (match === "{\\i1}") return "<i>";
        if (match === "{\\i0}") return "</i>";
        if (match === "{\\b1}") return "<b>";
        if (match === "{\\b0}") return "</b>";
        if (match === "{\\u1}") return "<u>";
        if (match === "{\\u0}" || match === "{\\u0}") return "</u>";
        return "";
    });

    processedText = processedText.replace(/\\n/gi, "<br>");

    return {
        text: processedText,
        positionTop: shouldPositionTop,
    };
};

// Subtitle search
export const findSubtitleByTime = (
    currentTimeSeconds: number, 
    subtitleData: Array<{ timestamp: number; text: string }>
) => {
    // Virtual rendering window optimization
    const visibleSubtitles = subtitleData.filter(subtitle =>
        subtitle.timestamp >= Math.max(0, currentTimeSeconds - 60) &&
        subtitle.timestamp <= currentTimeSeconds + 60
    );

    if (visibleSubtitles.length === 0) return null;

    let left = 0;
    let right = visibleSubtitles.length - 1;
    let currentSub = null;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const subtitle = visibleSubtitles[mid];

        if (subtitle.timestamp <= currentTimeSeconds) {
            currentSub = subtitle;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    if (currentSub && currentTimeSeconds - currentSub.timestamp <= 5) {
        return currentSub;
    }

    return null;
};

// Blur hash decoding
export const decodeBlurHash = async (blurHash: string, decode: any): Promise<string | null> => {
    try {
        const pixels = decode(blurHash, 32, 32);
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const imageData = ctx.createImageData(32, 32);
            imageData.data.set(pixels);
            ctx.putImageData(imageData, 0, 0);
            return canvas.toDataURL();
        }
    } catch (error) {
        console.error("Error decoding blur hash:", error);
    }
    return null;
};

// Format end time
export const formatEndTime = (currentSeconds: number, durationSeconds: number) => {
    const remainingSeconds = durationSeconds - currentSeconds;
    const endTime = new Date(Date.now() + remainingSeconds * 1000);
    return endTime.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
};
