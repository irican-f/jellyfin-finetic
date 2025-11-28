"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    CustomSubtitleTrack,
    MediaPlayer,
    MediaPlayerVideo,
} from "@/components/ui/media-player";
import MuxVideo from "@mux/mux-video-react";
import { ArrowLeft } from "lucide-react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
    isPlayerVisibleAtom,
    currentMediaAtom,
    skipTimestampAtom,
    currentTimestampAtom,
} from "@/lib/atoms";
import {
    reportPlaybackProgress,
    reportPlaybackStart,
    reportPlaybackStopped,
} from "@/app/actions";
import { getSubtitleContent } from "@/app/actions/subtitles";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/contexts/settings-context";
import { useSyncPlay } from "@/contexts/SyncPlayContext";
import { SyncPlayPlayerInterface } from "@/types/syncplay";
import { decode } from "blurhash";

// Hooks
import { usePlayerState } from "./hooks/use-player-state";
import { useMediaLoader } from "./hooks/use-media-loader";
import { useEpisodeNavigation } from "./hooks/use-episode-navigation";

// Utils
import {
    debounce,
    secondsToTicks,
    ticksToSeconds,
    formatEndTime,
    processSubtitleText as processSubtitleTextUtil,
    findSubtitleByTime,
    decodeBlurHash
} from "./utils/player-utils";

// Components
import { SubtitleDisplay } from "./ui/subtitle-display";
import { SkipSegmentButton } from "./ui/skip-segment-button";
import { PlayerOverlay } from "./ui/player-overlay";
import { PlayerControls } from "./ui/player-controls";
import { JellyfinItem } from "@/types/jellyfin";

interface GlobalMediaPlayerProps {
    onToggleAIAsk?: () => void;
}

export function GlobalMediaPlayer({ onToggleAIAsk }: GlobalMediaPlayerProps) {
    const router = useRouter();
    const { serverUrl } = useAuth();
    const { videoBitrate, preferredAudioLanguage, preferredSubtitleLanguage } = useSettings();

    // Atoms
    const [isPlayerVisible, setIsPlayerVisible] = useAtom(isPlayerVisibleAtom);
    const currentMedia = useAtomValue(currentMediaAtom);
    const skipTimestamp = useAtomValue(skipTimestampAtom);
    const setCurrentTimestamp = useSetAtom(currentTimestampAtom); // Only set, don't subscribe!

    // Hooks
    const {
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
    } = usePlayerState();

    const [chapters, setChapters] = useState<any[]>([]);

    const {
        loading,
        mediaDetails,
        streamUrl,
        selectedVersion,
        audioTracks,
        selectedAudioTrackIndex,
        setSelectedAudioTrackIndex,
        subtitleTracks,
        setSubtitleTracks,
        subtitleData,
        setSubtitleData,
        playSessionId,
        fetchingSubtitles,
        setFetchingSubtitles,
        mediaSegments,
        preferredSubtitleToLoad,
        setPreferredSubtitleToLoad,
        loadMedia,
        updateStreamUrl,
        convertJellyfinChapters,
        setPlaySessionId,
        setMediaDetails,
        setStreamUrl,
        setSelectedVersion,
        setMediaSegments,
    } = useMediaLoader({
        currentMedia,
        videoBitrate: Number(videoBitrate),
        preferredAudioLanguage,
        preferredSubtitleLanguage,
        setCurrentMediaWithSource,
        setChapters,
        ticksToSeconds
    });

    const {
        nextEpisode,
        previousEpisode,
        seasonEpisodes,
        loadEpisodeNavigation
    } = useEpisodeNavigation(currentMedia);

    // SyncPlay integration
    const {
        currentGroup,
        isEnabled: isSyncPlayEnabled,
        registerPlayer,
    } = useSyncPlay();

    // Local state
    const [backdropImageLoaded, setBackdropImageLoaded] = useState(false);
    const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
    const [currentSubtitle, setCurrentSubtitle] = useState<{ text: string; positionTop: boolean } | null>(null);
    const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const blobUrlsRef = useRef<string[]>([]);
    const playerInterfaceRef = useRef<SyncPlayPlayerInterface | null>(null);
    const eventHandlersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
    const processedSubtitleCache = useRef<Map<string, any>>(new Map());
    const lastSubtitleRef = useRef<string | null>(null);
    const lastUpdateTime = useRef(0);
    const lastEndTimeUpdate = useRef(0);

    // Event Emitter
    const emitEvent = useCallback((event: string, ...args: any[]) => {
        const handlers = eventHandlersRef.current.get(event);
        if (handlers && handlers.size > 0) {
            handlers.forEach(handler => handler(...args));
        } else {
            // console.warn(`⚠️ No handlers registered for event: ${event}`);
        }
    }, []);

    // Handlers
    const handleMouseMove = useCallback(() => {
        showControls();
    }, [showControls]);

    const debouncedMouseMove = useCallback(
        debounce(handleMouseMove, 50),
        [handleMouseMove]
    );

    const handleMouseLeave = useCallback(() => {
        showControls(); // This will trigger the timeout to hide
    }, [showControls]);

    // Memoize converted chapters
    const memoizedChapters = useMemo(() => {
        if (mediaDetails?.Chapters && mediaDetails.Chapters.length > 0) {
            return convertJellyfinChapters(mediaDetails.Chapters, duration);
        }
        return [];
    }, [mediaDetails?.Chapters, convertJellyfinChapters, duration]);

    // Start progress tracking
    const startProgressTracking = useCallback(async () => {
        if (!currentMedia || !selectedVersion || !videoRef.current) return;

        if (currentMedia.id === "test-big-buck-bunny") {
            console.log("🧪 Skipping progress tracking for test video");
            setHasStartedPlayback(true);
            return;
        }

        const sessionId = crypto.randomUUID();
        setPlaySessionId(sessionId);

        await reportPlaybackStart(currentMedia.id, selectedVersion.Id!, sessionId);
        setHasStartedPlayback(true);

        progressIntervalRef.current = setInterval(async () => {
            if (videoRef.current && !videoRef.current.paused) {
                const currentTime = videoRef.current.currentTime;
                const positionTicks = secondsToTicks(currentTime);

                await reportPlaybackProgress(
                    currentMedia.id,
                    selectedVersion.Id!,
                    sessionId,
                    positionTicks,
                    videoRef.current.paused
                );
            }
        }, 10000);
    }, [currentMedia, selectedVersion, setPlaySessionId, setHasStartedPlayback]);

    // Stop progress tracking
    const stopProgressTracking = useCallback(async () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        if (playSessionId && currentMedia && selectedVersion && videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            const positionTicks = secondsToTicks(currentTime);

            await reportPlaybackStopped(
                currentMedia.id,
                selectedVersion.Id!,
                playSessionId,
                positionTicks
            );
        }

        setPlaySessionId(null);
        setHasStartedPlayback(false);
    }, [playSessionId, currentMedia, selectedVersion, setPlaySessionId, setHasStartedPlayback]);

    // RAF time update
    const updateTimeWithRAF = useCallback(() => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            currentTimeRef.current = currentTime;
            setCurrentTimestamp(currentTime);

            const now = performance.now();
            if (now - lastUpdateTime.current >= 100) {
                setCurrentTime(currentTime);
                lastUpdateTime.current = now;
            }

            if (now - lastEndTimeUpdate.current >= 1000) {
                const endTime = formatEndTime(currentTime, duration);
                setDisplayEndTime(endTime);
                lastEndTimeUpdate.current = now;
            }

            rafRef.current = requestAnimationFrame(updateTimeWithRAF);
        }
    }, [setCurrentTimestamp, duration, setCurrentTime, setDisplayEndTime, currentTimeRef, rafRef]);

    // Video Event Handlers
    const handleVideoPlay = useCallback(async () => {
        if (isSyncPlayEnabled && currentGroup && currentGroup.State === 'Waiting') {
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
            return;
        }

        setVideoStarted(true);
        if (!hasStartedPlayback) {
            startProgressTracking();
        }

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(updateTimeWithRAF);

        if (isSyncPlayEnabled) {
            emitEvent('userPlay');
        }
    }, [hasStartedPlayback, startProgressTracking, isSyncPlayEnabled, currentGroup, updateTimeWithRAF, setVideoStarted, rafRef, emitEvent]);

    const handleVideoPause = useCallback(async () => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = undefined;
        }

        if (playSessionId && currentMedia && selectedVersion && videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            const positionTicks = secondsToTicks(currentTime);

            await reportPlaybackProgress(
                currentMedia.id,
                selectedVersion.Id!,
                playSessionId,
                positionTicks,
                true
            );
        }

        if (isSyncPlayEnabled) {
            emitEvent('userPause');
        }
    }, [playSessionId, currentMedia, selectedVersion, isSyncPlayEnabled, emitEvent, rafRef]);

    const handleVideoSeeked = useCallback(async () => {
        if (videoRef.current && isSyncPlayEnabled && currentGroup) {
            const currentTime = videoRef.current.currentTime;
            emitEvent('userSeek', currentTime);
        }
    }, [isSyncPlayEnabled, currentGroup, emitEvent]);

    const handleDurationChange = useCallback(() => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (memoizedChapters.length > 0) {
                setChapters(memoizedChapters);
            }
        }
    }, [memoizedChapters, setDuration, setChapters]);

    const handleVideoLoadedMetadata = useCallback(async () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);

            if (seekToTime !== null) {
                videoRef.current.currentTime = seekToTime;
                setSeekToTime(null);
                if (!isSyncPlayEnabled || (currentGroup && currentGroup.State !== 'Waiting')) {
                    videoRef.current.play();
                }
            } else if (currentMedia?.resumePositionTicks) {
                const resumeTime = ticksToSeconds(currentMedia.resumePositionTicks);
                videoRef.current.currentTime = resumeTime;
                setCurrentTime(resumeTime);
                if (!isSyncPlayEnabled || (currentGroup && currentGroup.State !== 'Waiting')) {
                    videoRef.current.play();
                }
            }

            if (isSyncPlayEnabled) {
                emitEvent('videoCanPlay');
            }
        }
    }, [currentMedia, seekToTime, isSyncPlayEnabled, currentGroup, emitEvent, setDuration, setSeekToTime, setCurrentTime]);

    const handleVideoWaiting = useCallback(async () => {
        if (isSyncPlayEnabled) {
            emitEvent('videoBuffering');
        }
    }, [isSyncPlayEnabled, emitEvent]);

    const handleVideoCanPlay = useCallback(async () => {
        if (isSyncPlayEnabled) {
            emitEvent('videoCanPlay');
        }
    }, [isSyncPlayEnabled, emitEvent]);

    const createPlayerInterface = useCallback(() => {
        if (!videoRef.current || playerInterfaceRef.current) return;

        playerInterfaceRef.current = {
            getCurrentTime: () => videoRef.current?.currentTime ?? 0,
            getPositionTicks: () => secondsToTicks(videoRef.current?.currentTime ?? 0),
            isPaused: () => videoRef.current?.paused ?? true,
            isReady: () => {
                if (!videoRef.current) return false;
                return videoRef.current.readyState >= 1;
            },
            play: () => {
                if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play();
                }
            },
            pause: () => {
                if (videoRef.current && !videoRef.current.paused) {
                    videoRef.current.pause();
                }
            },
            seek: (timeInSeconds: number) => {
                if (videoRef.current) {
                    videoRef.current.currentTime = timeInSeconds;
                    setCurrentTime(timeInSeconds);
                }
            },
            seekToTicks: (positionTicks: number) => {
                if (videoRef.current) {
                    const timeInSeconds = ticksToSeconds(positionTicks);
                    videoRef.current.currentTime = timeInSeconds;
                    setCurrentTime(timeInSeconds);
                }
            },
            on: (event: string, handler: (...args: any[]) => void) => {
                if (!eventHandlersRef.current.has(event)) {
                    eventHandlersRef.current.set(event, new Set());
                }
                eventHandlersRef.current.get(event)!.add(handler);
            },
            off: (event: string, handler: (...args: any[]) => void) => {
                const handlers = eventHandlersRef.current.get(event);
                if (handlers) {
                    handlers.delete(handler);
                }
            },
            once: (event: string, handler?: (...args: any[]) => void): Promise<void> => {
                return new Promise((resolve) => {
                    const onceHandler = (...args: any[]) => {
                        const handlers = eventHandlersRef.current.get(event);
                        if (handlers) {
                            handlers.delete(onceHandler);
                        }
                        if (handler) {
                            handler(...args);
                        }
                        resolve();
                    };
                    if (!eventHandlersRef.current.has(event)) {
                        eventHandlersRef.current.set(event, new Set());
                    }
                    eventHandlersRef.current.get(event)!.add(onceHandler);
                });
            },
        };

        if (registerPlayer) {
            registerPlayer(playerInterfaceRef.current);
        }
    }, [registerPlayer, setCurrentTime]);

    const cleanupBlobUrls = useCallback(() => {
        blobUrlsRef.current.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn("Failed to revoke blob URL:", error);
            }
        });
        blobUrlsRef.current = [];
    }, []);

    const handleClose = useCallback(async () => {
        await stopProgressTracking();
        cleanupBlobUrls();
        resetState();

        setIsPlayerVisible(false);
        setStreamUrl(null);
        setMediaDetails(null);
        setSelectedVersion(null);
        setSubtitleTracks([]);
        setFetchingSubtitles(false);
        setCurrentMediaWithSource(null);
        setMediaSegments({});
        setBackdropImageLoaded(false);
        setBlurDataUrl(null);

        setTimeout(() => {
            router.refresh();
        }, 100);
    }, [stopProgressTracking, cleanupBlobUrls, resetState, setIsPlayerVisible, setStreamUrl, setMediaDetails, setSelectedVersion, setSubtitleTracks, setFetchingSubtitles, setCurrentMediaWithSource, setMediaSegments, setBackdropImageLoaded, setBlurDataUrl, router]);

    const handleAudioTrackChange = (track: { index: number }) => {
        if (videoRef.current) {
            setSeekToTime(videoRef.current.currentTime);
        }
        setSelectedAudioTrackIndex(track.index);
        updateStreamUrl(track.index);
    };

    const selectSubtitleTrack = useCallback(
        (subtitleTrack: CustomSubtitleTrack | null) => {
            processedSubtitleCache.current.clear();
            lastSubtitleRef.current = null;

            if (!subtitleTrack) {
                setSubtitleData([]);
                setCurrentSubtitle(null);
                setSubtitleTracks((prev) =>
                    prev.map((track) => ({ ...track, active: false })),
                );
                return;
            }

            const trackIndex = subtitleTracks.findIndex(
                (track) => track.label === subtitleTrack.label,
            );
            if (trackIndex !== -1 && currentMedia && selectedVersion) {
                setFetchingSubtitles(true);
                getSubtitleContent(currentMedia.id, selectedVersion.Id!, trackIndex).then(
                    (result) => {
                        setFetchingSubtitles(false);
                        if (result.success) {
                            setSubtitleData(result.subtitles);
                            setCurrentSubtitle(null);
                            setSubtitleTracks((prev) =>
                                prev.map((track, idx) => ({
                                    ...track,
                                    active: idx === trackIndex,
                                })),
                            );
                        }
                    },
                );
            }
        },
        [currentMedia, selectedVersion, subtitleTracks, setFetchingSubtitles, setSubtitleData, setSubtitleTracks],
    );

    const handleVideoEnded = useCallback(async () => {
        await stopProgressTracking();
        handleClose();
    }, [stopProgressTracking, handleClose]);

    const processSubtitleText = useCallback((text: string) => {
        if (processedSubtitleCache.current.has(text)) {
            return processedSubtitleCache.current.get(text);
        }

        const result = processSubtitleTextUtil(text);

        processedSubtitleCache.current.set(text, result);
        return result;
    }, []);

    const findCurrentSubtitle = useCallback(
        (currentTimeSeconds: number) => {
            const subtitle = findSubtitleByTime(currentTimeSeconds, subtitleData);
            if (subtitle) {
                return processSubtitleText(subtitle.text);
            }
            return null;
        },
        [subtitleData, processSubtitleText]
    );

    const getActiveSegment = useCallback(() => {
        if (mediaSegments.intro) {
            const { startTime, endTime } = mediaSegments.intro;
            if (currentTime >= startTime && currentTime < endTime) {
                return { type: 'intro', endTime };
            }
        }
        if (mediaSegments.outro) {
            const { startTime, endTime } = mediaSegments.outro;
            if (currentTime >= startTime && currentTime < endTime) {
                return { type: 'outro', endTime };
            }
        }
        return null;
    }, [mediaSegments, currentTime]);

    const handleSkipSegment = useCallback(() => {
        const segment = getActiveSegment();
        if (segment && videoRef.current) {
            videoRef.current.currentTime = segment.endTime;
            setCurrentTime(segment.endTime);
        }
    }, [getActiveSegment, setCurrentTime, videoRef]);

    const activeSegment = getActiveSegment();

    const handleEpisodeTransition = useCallback(async (episode: JellyfinItem) => {
        await stopProgressTracking();

        setCurrentMediaWithSource({
            id: episode.Id!,
            name: episode.Name!,
            type: episode.Type as "Episode" | "Movie",
            mediaSourceId: episode.MediaSources?.[0]?.Id || null,
        });

        playMedia({
            id: episode.Id!,
            name: episode.Name!,
            type: episode.Type as "Episode" | "Movie",
        });
    }, [stopProgressTracking, setCurrentMediaWithSource, playMedia]);

    const handleNextEpisode = useCallback(() => {
        if (nextEpisode) handleEpisodeTransition(nextEpisode);
    }, [nextEpisode, handleEpisodeTransition]);

    const handlePreviousEpisode = useCallback(() => {
        if (previousEpisode) handleEpisodeTransition(previousEpisode);
    }, [previousEpisode, handleEpisodeTransition]);

    const handleEpisodeSelect = useCallback((episode: JellyfinItem) => {
        if (episode && episode.Id !== currentMedia?.id) {
            handleEpisodeTransition(episode);
        }
    }, [currentMedia, handleEpisodeTransition]);

    // Effects
    useEffect(() => {
        if (preferredSubtitleToLoad) {
            selectSubtitleTrack(preferredSubtitleToLoad);
            setPreferredSubtitleToLoad(null);
        }
    }, [preferredSubtitleToLoad, selectSubtitleTrack, setPreferredSubtitleToLoad]);

    useEffect(() => {
        if (currentMedia && isPlayerVisible) {
            processedSubtitleCache.current.clear();
            lastSubtitleRef.current = null;
            resetState();
            setBackdropImageLoaded(false);
            setBlurDataUrl(null);
            loadMedia(async () => emitEvent('videoLoaded'));
            loadEpisodeNavigation();
        }
    }, [currentMedia, isPlayerVisible, videoBitrate]); // Added loadEpisodeNavigation

    useEffect(() => {
        if (isPlayerVisible && videoStarted) {
            showControls();
        }
    }, [isPlayerVisible, videoStarted, showControls]);

    useEffect(() => {
        const subtitle = findCurrentSubtitle(currentTime);
        if (subtitle?.text !== lastSubtitleRef.current) {
            setCurrentSubtitle(subtitle);
            lastSubtitleRef.current = subtitle?.text || null;
        }
    }, [currentTime, findCurrentSubtitle]);

    useEffect(() => {
        if (skipTimestamp !== null && videoRef.current) {
            videoRef.current.currentTime = skipTimestamp;
            setCurrentTime(skipTimestamp);
        }
    }, [skipTimestamp, setCurrentTime, videoRef]);

    // Blur hash effect
    useEffect(() => {
        if (mediaDetails && !blurDataUrl) {
            const backdropImageTag = mediaDetails.Type === "Episode"
                ? mediaDetails.ParentBackdropImageTags?.[0]
                : mediaDetails.BackdropImageTags?.[0];
            const blurHash =
                mediaDetails.ImageBlurHashes?.["Backdrop"]?.[backdropImageTag!] || "";

            if (blurHash && blurHash.length > 0) {
                const decodeBlurHashFunc = async () => {
                    const dataUrl = await decodeBlurHash(blurHash, decode);
                    if (dataUrl) setBlurDataUrl(dataUrl);
                };

                if ('requestIdleCallback' in window) {
                    (window as any).requestIdleCallback(decodeBlurHashFunc, { timeout: 1000 });
                } else {
                    setTimeout(decodeBlurHashFunc, 0);
                }
            }
        }
    }, [mediaDetails, blurDataUrl]);

    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            cleanupBlobUrls();
            processedSubtitleCache.current.clear();
        };
    }, [cleanupBlobUrls, rafRef]);

    if (!isPlayerVisible || !currentMedia) {
        return null;
    }

    const customAudioTracks = audioTracks.map(track => ({
        label: track.DisplayTitle || track.Language || `Track ${track.Index}`,
        language: track.Language ?? undefined,
        index: track.Index!,
        active: track.Index === selectedAudioTrackIndex
    }));

    return (
        <div
            className="fixed inset-0 z-[999999] bg-black flex items-center justify-center w-screen"
            onMouseMove={debouncedMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <MediaPlayer
                autoHide
                onEnded={handleClose}
                onMediaError={(error) => {
                    console.warn("Media player error caught:", error);
                }}
                className="w-screen"
                customAudioTracks={customAudioTracks}
                onCustomAudioTrackChange={handleAudioTrackChange}
                customSubtitleTracks={subtitleTracks}
                customSubtitlesEnabled={subtitleTracks.length > 0}
                chapters={chapters}
                onCustomSubtitleChange={selectSubtitleTrack}
            >
                {/* Video Component */}
                {streamUrl && mediaDetails && (
                    <MediaPlayerVideo asChild>
                        <MuxVideo
                            // @ts-ignore
                            ref={(el) => {
                                const previousEl = videoRef.current;
                                videoRef.current = el ?? null;
                                if (el && !previousEl) {
                                    createPlayerInterface();
                                }
                            }}
                            src={streamUrl}
                            crossOrigin=""
                            playsInline
                            preload="auto"
                            autoPlay={!currentMedia?.resumePositionTicks && !isSyncPlayEnabled}
                            className="h-screen bg-black w-screen"
                            onPlay={handleVideoPlay}
                            onPause={handleVideoPause}
                            onEnded={handleVideoEnded}
                            onLoadedMetadata={handleVideoLoadedMetadata}
                            onWaiting={handleVideoWaiting}
                            onCanPlay={handleVideoCanPlay}
                            onSeeked={handleVideoSeeked}
                            onDurationChange={handleDurationChange}
                            onError={(event) => {
                                console.warn("Video error caught:", event);
                            }}
                        />
                    </MediaPlayerVideo>
                )}

                {/* Back Button */}
                {streamUrl && mediaDetails && (
                    <Button
                        variant="ghost"
                        className="fixed left-4 top-4 z-10 hover:backdrop-blur-md"
                        onClick={handleClose}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                )}

                {/* Loading Overlay */}
                <PlayerOverlay
                    visible={loading || !streamUrl || !mediaDetails}
                    mediaDetails={mediaDetails}
                    currentMediaName={currentMedia.name}
                    serverUrl={serverUrl || ""}
                    backdropImageLoaded={backdropImageLoaded}
                    blurDataUrl={blurDataUrl}
                    onClose={handleClose}
                    onBackdropLoad={() => setBackdropImageLoaded(true)}
                    formatEndTime={formatEndTime}
                />

                <SubtitleDisplay subtitle={currentSubtitle} />

                <SkipSegmentButton
                    show={!!activeSegment}
                    onSkip={handleSkipSegment}
                    label={activeSegment?.type === 'outro' ? "Skip Outro" : "Skip Intro"}
                />

                <PlayerControls
                    visible={controlsVisible}
                    isSyncPlayEnabled={isSyncPlayEnabled}
                    currentGroup={currentGroup}
                    fetchingSubtitles={fetchingSubtitles}
                    mediaDetails={mediaDetails}
                    currentMediaName={currentMedia.name}
                    duration={duration}
                    currentTime={currentTime}
                    displayEndTime={displayEndTime}
                    previousEpisode={previousEpisode}
                    nextEpisode={nextEpisode}
                    seasonEpisodes={seasonEpisodes}
                    currentEpisodeId={currentMedia.id}
                    serverUrl={serverUrl || ""}
                    onPreviousEpisode={handlePreviousEpisode}
                    onNextEpisode={handleNextEpisode}
                    onEpisodeSelect={handleEpisodeSelect}
                    onToggleAIAsk={onToggleAIAsk}
                />
            </MediaPlayer>
        </div>
    );
}
