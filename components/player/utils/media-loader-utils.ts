import {
    fetchMediaDetails
} from "@/app/actions/media";
import {
    getPlaybackUrl,
    getSubtitleTracks
} from "@/app/actions/utils";
import { getSubtitleContent } from "@/app/actions/subtitles";
import { JellyfinItem, MediaSourceInfo, MediaStream } from "@/types/jellyfin";
import { BITRATE_OPTIONS } from "@/contexts/settings-context";
import { canDirectPlay, getOptimalStreamingParams } from "@/lib/device-detection";
import { CustomSubtitleTrack } from "@/components/ui/media-player";
import { MediaToPlay } from "@/lib/atoms";

export interface LoadMediaParams {
    currentMedia: MediaToPlay;
    videoBitrate: number;
    preferredAudioLanguage: string;
    preferredSubtitleLanguage: string;
}

export interface MediaLoadResult {
    details: JellyfinItem;
    sourceToUse: MediaSourceInfo;
    audioStreams: MediaStream[];
    initialAudioTrackIndex: number;
    streamUrl: string;
    playSessionId: string;
    subtitleTracks: CustomSubtitleTrack[];
    preferredSubtitleTrack: CustomSubtitleTrack | null;
    mediaSegments: {
        intro?: { startTime: number; endTime: number };
        outro?: { startTime: number; endTime: number };
    };
}

// Helper to convert ticks to seconds
const ticksToSeconds = (ticks: number) => ticks / 10000000;

export async function fetchAndPrepareMedia({
    currentMedia,
    videoBitrate,
    preferredAudioLanguage,
    preferredSubtitleLanguage,
}: LoadMediaParams): Promise<MediaLoadResult | null> {
    try {
        // 1. Fetch Media Details
        const details = await fetchMediaDetails(currentMedia.id);
        if (!details) {
            console.error("Failed to fetch media details");
            return null;
        }

        if (!details.MediaSources || details.MediaSources.length === 0) {
            console.error("No media sources found");
            return null;
        }

        // 2. Select Media Source
        let sourceToUse = details.MediaSources[0];
        if (currentMedia.selectedVersion) {
            const matchingSource = details.MediaSources.find(
                (source) => source.Id === currentMedia.selectedVersion!.Id
            );
            if (matchingSource) {
                sourceToUse = matchingSource;
            }
        }

        // 3. Setup Audio Tracks
        const audioStreams = sourceToUse.MediaStreams?.filter(
            (stream) => stream.Type === "Audio",
        ) || [];

        let preferredAudioTrack;
        if (preferredAudioLanguage === "vo") {
            preferredAudioTrack = audioStreams.find((stream) =>
                stream.DisplayTitle?.toLowerCase().includes("vo"),
            );
        } else {
            preferredAudioTrack = audioStreams.find(
                (stream) => stream.Language === preferredAudioLanguage,
            );
        }

        if (!preferredAudioTrack) {
            preferredAudioTrack = audioStreams.find((stream) => stream.IsDefault);
        }
        const initialAudioTrackIndex = preferredAudioTrack?.Index ?? audioStreams[0]?.Index;

        // 4. Generate Stream URL
        const bitrateOption = BITRATE_OPTIONS.find(
            (option) => option.value === String(videoBitrate)
        );
        const bitrate = bitrateOption?.bitrate || 0;

        const directPlay = canDirectPlay(sourceToUse);
        const streamingParams = getOptimalStreamingParams();
        if (bitrate > 0) {
            streamingParams.videoBitrate = bitrate;
        }

        let streamUrl = "";
        let playSessionId = "";

        if (initialAudioTrackIndex !== undefined && initialAudioTrackIndex !== null) {
            const playbackResult = await getPlaybackUrl(
                currentMedia.id,
                sourceToUse,
                directPlay,
                streamingParams,
                initialAudioTrackIndex
            );
            streamUrl = playbackResult.streamUrl;
            playSessionId = playbackResult.playSessionId;
        }

        // 5. Setup Subtitles
        const subtitleTracksList = await getSubtitleTracks(
            currentMedia.id,
            sourceToUse.Id!,
        );

        let preferredSubtitleTrackIndex = -1;
        const fullSubtitleIndex = subtitleTracksList.findIndex(
            (track) =>
                (track.language === preferredSubtitleLanguage || track.label.toLowerCase().startsWith(preferredSubtitleLanguage)) && !track.isForced,
        );

        if (fullSubtitleIndex !== -1) {
            preferredSubtitleTrackIndex = fullSubtitleIndex;
        } else {
            const forcedSubtitleIndex = subtitleTracksList.findIndex(
                (track) =>
                    track.language === preferredSubtitleLanguage && track.isForced,
            );
            if (forcedSubtitleIndex !== -1) {
                preferredSubtitleTrackIndex = forcedSubtitleIndex;
            }
        }

        const subtitleTracks = subtitleTracksList.map((track, index) => ({
            ...track,
            kind: track.kind as TextTrackKind,
            active: index === preferredSubtitleTrackIndex,
        }));

        let preferredSubtitleTrack = null;
        if (preferredSubtitleTrackIndex !== -1) {
            preferredSubtitleTrack = subtitleTracks[preferredSubtitleTrackIndex];
        }

        // 6. Extract Intro/Outro from Chapters
        const mediaSegments: {
            intro?: { startTime: number; endTime: number };
            outro?: { startTime: number; endTime: number };
        } = {};

        if (details.Chapters) {
            details.Chapters.forEach((chapter, index) => {
                const name = chapter.Name?.toLowerCase() || "";
                const startTime = ticksToSeconds(chapter.StartPositionTicks || 0);

                let endTime = 0;
                if (index < (details.Chapters?.length || 0) - 1) {
                    endTime = ticksToSeconds(details.Chapters![index + 1].StartPositionTicks || 0);
                } else {
                    endTime = ticksToSeconds(details.RunTimeTicks || 0);
                }

                if (name.includes("intro") || name.includes("opening")) {
                    mediaSegments.intro = { startTime, endTime };
                } else if (name.includes("outro") || name.includes("credits") || name.includes("ending")) {
                    mediaSegments.outro = { startTime, endTime };
                }
            });
        }

        return {
            details,
            sourceToUse,
            audioStreams,
            initialAudioTrackIndex: initialAudioTrackIndex ?? 0,
            streamUrl,
            playSessionId,
            subtitleTracks,
            preferredSubtitleTrack,
            mediaSegments,
        };

    } catch (error) {
        console.error("Error in fetchAndPrepareMedia:", error);
        throw error;
    }
}

