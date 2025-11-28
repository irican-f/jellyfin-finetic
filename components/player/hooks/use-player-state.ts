import { useState, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { currentMediaWithSourceAtom, playMediaAtom } from '@/lib/atoms';

export function usePlayerState() {
    // Atoms
    const setCurrentMediaWithSource = useSetAtom(currentMediaWithSourceAtom);
    const playMedia = useSetAtom(playMediaAtom);
    
    // Local state
    const [videoStarted, setVideoStarted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [seekToTime, setSeekToTime] = useState<number | null>(null);
    const [displayEndTime, setDisplayEndTime] = useState<string>("");
    const [controlsVisible, setControlsVisible] = useState(true);

    // Refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const currentTimeRef = useRef(0);
    const rafRef = useRef<number | undefined>(undefined);
    const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Controls visibility logic
    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }
        hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
        }, 5000);
    }, []);

    // Reset state
    const resetState = useCallback(() => {
        setVideoStarted(false);
        setCurrentTime(0);
        setDuration(0);
        setControlsVisible(true);
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = undefined;
        }
    }, []);

    return {
        videoRef,
        currentTimeRef,
        rafRef,
        videoStarted,
        setVideoStarted,
        currentTime,
        setCurrentTime,
        duration,
        setDuration,
        seekToTime,
        setSeekToTime,
        displayEndTime,
        setDisplayEndTime,
        controlsVisible,
        showControls,
        resetState,
        setCurrentMediaWithSource,
        playMedia,
    };
}
