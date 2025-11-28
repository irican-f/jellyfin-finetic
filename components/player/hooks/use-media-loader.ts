import { useState, useCallback } from 'react';
import { JellyfinItem, MediaSourceInfo, MediaStream } from "@/types/jellyfin";
import { CustomSubtitleTrack } from "@/components/ui/media-player";
import { useSettings } from "@/contexts/settings-context";
import { canDirectPlay, getOptimalStreamingParams } from "@/lib/device-detection";
import { getPlaybackUrl } from "@/app/actions";
import { BITRATE_OPTIONS } from "@/contexts/settings-context";
import { MediaToPlay, CurrentMediaWithSource } from '@/lib/atoms';
import { fetchAndPrepareMedia } from '../utils/media-loader-utils';

interface UseMediaLoaderProps {
    currentMedia: MediaToPlay | null;
    videoBitrate: number;
    preferredAudioLanguage: string;
    preferredSubtitleLanguage: string;
    setCurrentMediaWithSource: (media: CurrentMediaWithSource | null) => void;
    setChapters: (chapters: any[]) => void;
    ticksToSeconds: (ticks: number) => number;
}

export function useMediaLoader({
    currentMedia,
    videoBitrate,
    preferredAudioLanguage,
    preferredSubtitleLanguage,
    setCurrentMediaWithSource,
    setChapters,
    ticksToSeconds
}: UseMediaLoaderProps) {
    const [loading, setLoading] = useState(false);
    const [mediaDetails, setMediaDetails] = useState<JellyfinItem | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<MediaSourceInfo | null>(null);
    const [audioTracks, setAudioTracks] = useState<MediaStream[]>([]);
    const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState<number | null>(null);
    const [subtitleTracks, setSubtitleTracks] = useState<CustomSubtitleTrack[]>([]);
    const [subtitleData, setSubtitleData] = useState<any[]>([]);
    const [playSessionId, setPlaySessionId] = useState<string | null>(null);
    const [fetchingSubtitles, setFetchingSubtitles] = useState(false);
    const [mediaSegments, setMediaSegments] = useState<{
        intro?: { startTime: number; endTime: number };
        outro?: { startTime: number; endTime: number };
    }>({});
    const [preferredSubtitleToLoad, setPreferredSubtitleToLoad] = useState<CustomSubtitleTrack | null>(null);

    // Helper to convert Jellyfin chapters
    const convertJellyfinChapters = useCallback((jellyfinChapters: any[], duration: number) => {
        if (!jellyfinChapters || jellyfinChapters.length === 0) return [];

        return jellyfinChapters.map((chapter, index) => {
            const startTime = ticksToSeconds(chapter.StartPositionTicks);
            const nextChapter = jellyfinChapters[index + 1];
            const endTime = nextChapter
                ? ticksToSeconds(nextChapter.StartPositionTicks)
                : duration;

            return {
                startTime,
                endTime,
                text: chapter.Name || `Chapter ${index + 1}`,
            };
        });
    }, [ticksToSeconds]);

    const loadMedia = async (emitVideoLoaded: () => void) => {
        if (!currentMedia) return;

        setLoading(true);
        try {
            const result = await fetchAndPrepareMedia({
                currentMedia,
                videoBitrate,
                preferredAudioLanguage,
                preferredSubtitleLanguage
            });

            if (!result) {
                // Error handling is logged in the utility
                return;
            }

            // Batch state updates
            setMediaDetails(result.details);
            setSelectedVersion(result.sourceToUse);
            setAudioTracks(result.audioStreams);
            setSelectedAudioTrackIndex(result.initialAudioTrackIndex);
            setStreamUrl(result.streamUrl);
            setPlaySessionId(result.playSessionId);
            setSubtitleTracks(result.subtitleTracks);
            setPreferredSubtitleToLoad(result.preferredSubtitleTrack);
            if (!result.preferredSubtitleTrack) {
                setSubtitleData([]);
            }
            setMediaSegments(result.mediaSegments);

            // Update global state atom
            setCurrentMediaWithSource({
                id: currentMedia.id,
                name: currentMedia.name,
                type: currentMedia.type,
                mediaSourceId: result.sourceToUse.Id || null,
            });

        } catch (error) {
            console.error("Failed to load media:", error);
        } finally {
            setLoading(false);
            emitVideoLoaded();
        }
    };

    const updateStreamUrl = async (audioIndex: number) => {
        if (!currentMedia || !selectedVersion) return;

        const bitrateOption = BITRATE_OPTIONS.find(
            (option) => option.value === String(videoBitrate)
        );
        const bitrate = bitrateOption?.bitrate || 0;

        const directPlay = canDirectPlay(selectedVersion);
        const streamingParams = getOptimalStreamingParams();
        if (bitrate > 0) {
            streamingParams.videoBitrate = bitrate;
        }

        const { streamUrl: url, playSessionId: sessionId } = await getPlaybackUrl(
            currentMedia.id,
            selectedVersion,
            directPlay,
            streamingParams,
            audioIndex
        );

        setPlaySessionId(sessionId);
        setStreamUrl(url);
    };

    return {
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
    };
}
