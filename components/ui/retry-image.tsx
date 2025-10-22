"use client";

import React, { useState, useCallback } from "react";

interface RetryImageProps {
    src: string;
    alt: string;
    className?: string;
    fallbackText?: string;
    maxRetries?: number;
    retryDelay?: number;
    onError?: () => void;
    onLoad?: () => void;
    fallbackUrls?: string[];
}

export function RetryImage({
    src,
    alt,
    className = "",
    fallbackText = "No Image",
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onLoad,
    fallbackUrls = [],
}: RetryImageProps) {
    const [retryCount, setRetryCount] = useState(0);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Start with false
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

    // Get current URL to use
    const getCurrentUrl = () => {
        if (currentUrlIndex === 0) {
            return src;
        } else if (currentUrlIndex <= fallbackUrls.length) {
            return fallbackUrls[currentUrlIndex - 1];
        }
        return src;
    };

    const handleError = useCallback(() => {
        // First try fallback URLs (different image types)
        if (currentUrlIndex < fallbackUrls.length) {
            setCurrentUrlIndex(prev => prev + 1);
            setRetryCount(0); // Reset retry count for new URL
        } else if (retryCount < maxRetries) {
            // Then retry current URL (same image type, different attempt)
            setRetryCount(prev => prev + 1);
        } else {
            setHasError(true);
            onError?.();
        }
    }, [retryCount, maxRetries, onError, currentUrlIndex, fallbackUrls.length, fallbackUrls, getCurrentUrl]);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
        onLoad?.();
    }, [onLoad]);

    if (hasError) {
        return (
            <div className={`w-full h-full bg-gray-800 flex items-center justify-center rounded-lg shadow-lg ${className}`}>
                <div className="text-white/60 text-sm">{fallbackText}</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <img
                src={getCurrentUrl()}
                alt={alt}
                className={`w-full h-full object-cover transition duration-200 shadow-lg hover:brightness-85 rounded-md border shadow-sm group-hover:shadow-md active:scale-[0.98] ${className}`}
                onError={handleError}
                onLoad={handleLoad}
                draggable="false"
            />
        </div>
    );
}
