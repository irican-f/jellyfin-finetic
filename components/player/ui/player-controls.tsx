import React from "react";
import { Button } from "@/components/ui/button";
import { Users, RotateCcw, RotateCw, Ship } from "lucide-react";
import { motion } from "framer-motion";
import {
    MediaPlayerControls,
    MediaPlayerControlsOverlay,
    MediaPlayerSeek,
    MediaPlayerPlay,
    MediaPlayerPreviousEpisode,
    MediaPlayerSeekBackward,
    MediaPlayerSeekForward,
    MediaPlayerNextEpisode,
    MediaPlayerTime,
    MediaPlayerVolume,
    MediaPlayerTooltip,
    MediaPlayerEpisodeSelector,
    MediaPlayerSettings,
    MediaPlayerPiP,
    MediaPlayerFullscreen,
} from "@/components/ui/media-player";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { JellyfinItem } from "@/types/jellyfin";
import { SyncPlayGroup } from "@/types/syncplay";
import { formatRuntime } from "@/lib/utils";

interface PlayerControlsProps {
    visible: boolean;
    isSyncPlayEnabled: boolean;
    currentGroup: SyncPlayGroup | null;
    fetchingSubtitles: boolean;
    mediaDetails: JellyfinItem | null;
    currentMediaName: string;
    duration: number;
    currentTime: number;
    displayEndTime: string;
    previousEpisode: JellyfinItem | null;
    nextEpisode: JellyfinItem | null;
    seasonEpisodes: JellyfinItem[];
    currentEpisodeId?: string;
    serverUrl: string;
    onPreviousEpisode: () => void;
    onNextEpisode: () => void;
    onEpisodeSelect: (episode: JellyfinItem) => void;
    onToggleAIAsk?: () => void;
}

export function PlayerControls({
    visible,
    isSyncPlayEnabled,
    currentGroup,
    fetchingSubtitles,
    mediaDetails,
    currentMediaName,
    duration,
    currentTime,
    displayEndTime,
    previousEpisode,
    nextEpisode,
    seasonEpisodes,
    currentEpisodeId,
    serverUrl,
    onPreviousEpisode,
    onNextEpisode,
    onEpisodeSelect,
    onToggleAIAsk,
}: PlayerControlsProps) {
    if (!visible) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
        >
            <MediaPlayerControls className="flex-col items-start gap-2.5 px-6 pb-4 z-[9999]">
                <div className="flex items-center justify-between w-full">
                    {isSyncPlayEnabled && currentGroup && (
                        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
                            <Users className="h-4 w-4 text-white" />
                            <span className="text-sm text-white font-medium">
                                {currentGroup.GroupName}
                            </span>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-white/70">
                                    {currentGroup.Participants?.length || 0}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {fetchingSubtitles && (
                    <div className="fixed right-4 top-16 z-10 bg-black/50 backdrop-blur-sm rounded-md px-3 py-2 text-white text-sm flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                        Fetching subtitles
                    </div>
                )}
                <MediaPlayerControlsOverlay />
                <div className="flex flex-col w-full gap-1.5 pb-2">
                    {mediaDetails?.SeriesName && (
                        <div className="text-sm text-white/70 truncate font-medium">
                            {mediaDetails.SeriesName}
                        </div>
                    )}

                    <div className="flex items-center justify-between w-full">
                        <h2 className="text-3xl font-semibold text-white truncate font-poppins">
                            {mediaDetails?.Type === "Episode" && mediaDetails?.IndexNumber
                                ? `${mediaDetails.IndexNumber}. ${mediaDetails.Name || currentMediaName}`
                                : mediaDetails?.Name || currentMediaName}
                        </h2>

                        {duration > 0 && currentTime >= 0 && displayEndTime && (
                            <div className="text-sm text-white/70 ml-4 whitespace-nowrap">
                                Ends at {displayEndTime}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-white/60">
                        {mediaDetails?.Type === "Episode" && (
                            <div className="space-x-1">
                                {mediaDetails?.ParentIndexNumber && (
                                    <span>S{mediaDetails.ParentIndexNumber}</span>
                                )}
                                <span>•</span>
                                {mediaDetails?.IndexNumber && (
                                    <span>E{mediaDetails.IndexNumber}</span>
                                )}
                            </div>
                        )}

                        {mediaDetails?.RunTimeTicks && (
                            <span>{formatRuntime(mediaDetails.RunTimeTicks)}</span>
                        )}

                        {mediaDetails?.ProductionYear && (
                            <span>{mediaDetails.ProductionYear}</span>
                        )}
                    </div>
                </div>
                <MediaPlayerSeek />
                <div className="flex w-full items-center gap-2">
                    <div className="flex flex-1 items-center gap-2">
                        <MediaPlayerPlay />
                        <MediaPlayerPreviousEpisode
                            previousEpisode={previousEpisode}
                            onPreviousEpisode={onPreviousEpisode}
                            className="text-white hover:bg-white/20"
                        />
                        <MediaPlayerSeekBackward>
                            <RotateCcw />
                        </MediaPlayerSeekBackward>
                        <MediaPlayerSeekForward>
                            <RotateCw />
                        </MediaPlayerSeekForward>
                        <MediaPlayerNextEpisode
                            nextEpisode={nextEpisode}
                            onNextEpisode={onNextEpisode}
                            className="text-white hover:bg-white/20"
                        />
                        <MediaPlayerTime />
                    </div>
                    <div className="flex items-center gap-2">
                        <MediaPlayerVolume expandable />

                        {onToggleAIAsk && (
                            <MediaPlayerTooltip tooltip="Navigator" shortcut="Cmd + K">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-white hover:bg-white/20"
                                    onClick={onToggleAIAsk}
                                >
                                    <Ship className="h-4 w-4" />
                                </Button>
                            </MediaPlayerTooltip>
                        )}
                        {mediaDetails?.People && mediaDetails.People.length > 0 && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <MediaPlayerTooltip tooltip="Cast & Crew">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-white hover:bg-white/20"
                                        >
                                            <Users className="h-4 w-4" />
                                        </Button>
                                    </MediaPlayerTooltip>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-80 bg-black/90 border-white/20 text-white z-[1000000]"
                                    side="top"
                                >
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg">Cast & Crew</h3>
                                        <div className="max-h-64 overflow-y-auto space-y-2">
                                            {mediaDetails.People.map((person, index) => (
                                                <div
                                                    key={`${person.Id}-${index}`}
                                                    className="flex items-center space-x-3 p-2 rounded hover:bg-white/10"
                                                >
                                                    <div className="flex-shrink-0">
                                                        {person.PrimaryImageTag ? (
                                                            <img
                                                                src={serverUrl ? `${serverUrl}/Items/${person.Id}/Images/Primary?fillHeight=759&fillWidth=506&quality=96` : ''}
                                                                alt={person.Name!}
                                                                className="w-8 h-8 rounded-full object-cover"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = "none";
                                                                    target.nextElementSibling!.classList.remove(
                                                                        "hidden"
                                                                    );
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div
                                                            className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs ${person.PrimaryImageTag ? "hidden" : ""}`}
                                                        >
                                                            {person.Name?.charAt(0) || "?"}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {person.Name}
                                                        </p>
                                                        {person.Role && (
                                                            <p className="text-xs text-white/70 truncate">
                                                                {person.Role}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <MediaPlayerEpisodeSelector
                            episodes={seasonEpisodes}
                            currentEpisodeId={currentEpisodeId}
                            onEpisodeSelect={onEpisodeSelect}
                            seriesName={mediaDetails?.SeriesName || undefined}
                            seasonNumber={mediaDetails?.ParentIndexNumber || undefined}
                            className="text-white hover:bg-white/20"
                        />
                        <MediaPlayerSettings />
                        <MediaPlayerPiP />
                        <MediaPlayerFullscreen />
                    </div>
                </div>
            </MediaPlayerControls>
        </motion.div>
    );
}

