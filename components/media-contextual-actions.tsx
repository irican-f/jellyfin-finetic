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
} from "lucide-react";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import { toast } from "sonner";
import { getDownloadUrl } from "@/app/actions/utils";

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

    const handlePlay = async () => {
        if (onPlay) {
            onPlay();
        } else {
            try {
                await playMedia({
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

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
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
                    Lire
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePlayAll} className="cursor-pointer">
                    <PlayCircle className="h-4 w-4" />
                    Tout lire à partir d'ici
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Adding and Collection Management */}
                <DropdownMenuItem onClick={handleSelect} className="cursor-pointer">
                    <CheckSquare className="h-4 w-4" />
                    Sélectionner
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddToCollection} className="cursor-pointer">
                    <Plus className="h-4 w-4" />
                    Ajouter à la collection
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleAddToPlaylist}
                    className="cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    Ajouter à la liste de lecture
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* File and Stream Operations */}
                <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="h-4 w-4" />
                    Télécharger
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyStreamUrl} className="cursor-pointer">
                    <Copy className="h-4 w-4" />
                    Copier l'URL du flux
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Supprimer l'épisode
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Editing and Information */}
                <DropdownMenuItem onClick={handleEditMetadata} className="cursor-pointer">
                    <Edit className="h-4 w-4" />
                    Éditer les métadonnées
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleModifyImages} className="cursor-pointer">
                    <Image className="h-4 w-4" />
                    Modifier les images
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleModifySubtitles} className="cursor-pointer">
                    <Subtitles className="h-4 w-4" />
                    Modifier les sous-titres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMediaInfo} className="cursor-pointer">
                    <Info className="h-4 w-4" />
                    Informations du média
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshMetadata} className="cursor-pointer">
                    <RefreshCw className="h-4 w-4" />
                    Actualiser les métadonnées
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
