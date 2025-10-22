"use client";

import React from "react";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Play,
    PlayCircle,
    CheckSquare,
    Plus,
    Download,
    Copy,
    Trash2,
    Edit,
    Image,
    Subtitles,
    Info,
    RefreshCw,
    MoreVertical,
    Eye,
    EyeOff,
    Users,
} from "lucide-react";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import { toast } from "sonner";
import { getDownloadUrl } from "@/app/actions/utils";
import { markItemAsPlayed, markItemAsUnplayed, removeFromNextUp } from "@/app/actions/playback";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSyncPlay } from "@/contexts/SyncPlayContext";

interface MediaContextualActionsProps {
    item: BaseItemDto;
    serverUrl: string;
    onPlay?: () => void;
    onPlayAll?: () => void;
    onSelect?: () => void;
    onAddToCollection?: () => void;
    onAddToPlaylist?: () => void;
    onDownload?: () => void;
    onCopyStreamUrl?: () => void;
    onDelete?: () => void;
    onEditMetadata?: () => void;
    onModifyImages?: () => void;
    onModifySubtitles?: () => void;
    onMediaInfo?: () => void;
    onRefreshMetadata?: () => void;
}

export function MediaContextualActions({
    item,
    serverUrl,
    onPlay,
    onPlayAll,
    onSelect,
    onAddToCollection,
    onAddToPlaylist,
    onDownload,
    onCopyStreamUrl,
    onDelete,
    onEditMetadata,
    onModifyImages,
    onModifySubtitles,
    onMediaInfo,
    onRefreshMetadata,
}: MediaContextualActionsProps) {
    const { playMedia, setIsPlayerVisible } = useMediaPlayer();
    const router = useRouter();
    const [isPlayed, setIsPlayed] = useState(item.UserData?.Played || false);

    // SyncPlay integration
    const { currentGroup, isEnabled: isSyncPlayEnabled, queueItems } = useSyncPlay();

    // Update isPlayed state when item changes
    useEffect(() => {
        setIsPlayed(item.UserData?.Played || false);
    }, [item.UserData?.Played]);

    const handlePlay = async () => {
        if (onPlay) {
            onPlay();
        } else {
            try {
                playMedia({
                    id: item.Id!,
                    name: item.Name!,
                    type: item.Type as "Movie" | "Series" | "Episode",
                    resumePositionTicks: item.UserData?.PlaybackPositionTicks,
                });
                setIsPlayerVisible(true);
            } catch (error) {
                toast.error("Failed to play media");
            }
        }
    };

    const handlePlayAll = async () => {
        if (onPlayAll) {
            onPlayAll();
        } else {
            toast.info("Play all functionality not implemented yet");
        }
    };

    const handleSelect = () => {
        if (onSelect) {
            onSelect();
        } else {
            toast.info("Select functionality not implemented yet");
        }
    };

    const handleAddToCollection = () => {
        if (onAddToCollection) {
            onAddToCollection();
        } else {
            toast.info("Add to collection functionality not implemented yet");
        }
    };

    const handleAddToPlaylist = () => {
        if (onAddToPlaylist) {
            onAddToPlaylist();
        } else {
            toast.info("Add to playlist functionality not implemented yet");
        }
    };

    const handleDownload = () => {
        if (onDownload) {
            onDownload();
        } else {
            toast.info("Download functionality not implemented yet");
        }
    };

    const handleCopyStreamUrl = async () => {
        if (onCopyStreamUrl) {
            onCopyStreamUrl();
        } else {
            try {
                const streamUrl = await getDownloadUrl(item.Id!);
                await navigator.clipboard.writeText(streamUrl);
                toast.success("Stream URL copied to clipboard");
            } catch (error) {
                toast.error("Failed to copy stream URL");
            }
        }
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete();
        } else {
            toast.info("Delete functionality not implemented yet");
        }
    };

    const handleEditMetadata = () => {
        if (onEditMetadata) {
            onEditMetadata();
        } else {
            toast.info("Edit metadata functionality not implemented yet");
        }
    };

    const handleModifyImages = () => {
        if (onModifyImages) {
            onModifyImages();
        } else {
            toast.info("Modify images functionality not implemented yet");
        }
    };

    const handleModifySubtitles = () => {
        if (onModifySubtitles) {
            onModifySubtitles();
        } else {
            toast.info("Modify subtitles functionality not implemented yet");
        }
    };

    const handleMediaInfo = () => {
        if (onMediaInfo) {
            onMediaInfo();
        } else {
            toast.info("Media information functionality not implemented yet");
        }
    };

    const handleRefreshMetadata = () => {
        if (onRefreshMetadata) {
            onRefreshMetadata();
        } else {
            toast.info("Refresh metadata functionality not implemented yet");
        }
    };

    const handleAddToSyncPlayQueue = async () => {
        if (!isSyncPlayEnabled || !currentGroup) {
            toast.error("You must be in a SyncPlay group to queue items");
            return;
        }

        try {
            await queueItems([item.Id!]);
            toast.success(`Added "${item.Name}" to SyncPlay queue`);
        } catch (error) {
            console.error('Failed to add to SyncPlay queue:', error);
            toast.error("Failed to add to SyncPlay queue");
        }
    };

    const handleMarkAsPlayed = async () => {
        try {
            await markItemAsPlayed(item.Id!);
            setIsPlayed(true);
            toast.success("Marked as played");
        } catch (error) {
            toast.error("Failed to mark as played");
        }
    };

    const handleMarkAsUnplayed = async () => {
        try {
            await markItemAsUnplayed(item.Id!);
            setIsPlayed(false);
            toast.success("Marked as unplayed");
        } catch (error) {
            toast.error("Failed to mark as unplayed");
        }
    };

    const handleRemoveFromNextUp = async () => {
        try {
            await removeFromNextUp(item.SeriesId!);
            setIsPlayed(true);
            toast.success("Removed from Next Up");
            // Trigger immediate refresh
            router.refresh();
        } catch (error) {
            toast.error("Failed to remove from Next Up");
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 cursor-pointer">
                    <MoreVertical className="h-4 w-4 text-white" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 bg-popover/95 backdrop-blur-sm border-border/50"
                sideOffset={8}
            >
                {/* Playback and Selection */}
                <DropdownMenuItem onClick={handlePlay} className="cursor-pointer">
                    <Play className="h-4 w-4" />
                    Play
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePlayAll} className="cursor-pointer">
                    <PlayCircle className="h-4 w-4" />
                    Play All from Here
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Mark as played/unplayed */}
                {isPlayed ? (
                    <DropdownMenuItem onClick={handleMarkAsUnplayed} className="cursor-pointer">
                        <EyeOff className="h-4 w-4" />
                        Mark as Unplayed
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem onClick={handleMarkAsPlayed} className="cursor-pointer">
                        <Eye className="h-4 w-4" />
                        Mark as Played
                    </DropdownMenuItem>
                )}

                {/* Remove from Next Up - only show for episodes that are not played */}
                {!isPlayed && item.Type === "Episode" && (
                    <DropdownMenuItem onClick={handleRemoveFromNextUp} className="cursor-pointer">
                        <Trash2 className="h-4 w-4" />
                        Remove from Next Up
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />

                {/* Adding and Collection Management */}
                <DropdownMenuItem onClick={handleSelect} className="cursor-pointer">
                    <CheckSquare className="h-4 w-4" />
                    Select
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddToCollection} className="cursor-pointer">
                    <Plus className="h-4 w-4" />
                    Add to Collection
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleAddToPlaylist}
                    className="cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    Add to Playlist
                </DropdownMenuItem>
                {isSyncPlayEnabled && currentGroup && (
                    <DropdownMenuItem
                        onClick={handleAddToSyncPlayQueue}
                        className="cursor-pointer"
                    >
                        <Users className="h-4 w-4" />
                        Add to SyncPlay Queue
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />

                {/* File and Stream Operations */}
                <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="h-4 w-4" />
                    Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyStreamUrl} className="cursor-pointer">
                    <Copy className="h-4 w-4" />
                    Copy Stream URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete Episode
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Editing and Information */}
                <DropdownMenuItem onClick={handleEditMetadata} className="cursor-pointer">
                    <Edit className="h-4 w-4" />
                    Edit Metadata
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleModifyImages} className="cursor-pointer">
                    <Image className="h-4 w-4" />
                    Modify Images
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleModifySubtitles} className="cursor-pointer">
                    <Subtitles className="h-4 w-4" />
                    Modify Subtitles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMediaInfo} className="cursor-pointer">
                    <Info className="h-4 w-4" />
                    Media Information
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshMetadata} className="cursor-pointer">
                    <RefreshCw className="h-4 w-4" />
                    Refresh Metadata
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
