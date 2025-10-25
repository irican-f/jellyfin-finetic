"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Play, Eye, EyeOff } from "lucide-react";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import { markItemAsPlayed, markItemAsUnplayed } from "@/app/actions/playback";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DOMPurify from "dompurify";
import parse from "html-react-parser";

import { decode } from "blurhash";
import { RetryImage } from "@/components/ui/retry-image";
import { generateImageFallbacks } from "@/lib/image-fallbacks";
import { MediaContextualActions } from "@/components/media-contextual-actions";
import { Badge } from "./ui/badge";

export function MediaCard({
  item,
  serverUrl,
  percentageWatched = 0,
  continueWatching = false,
  showProgress = false,
  resumePosition,
  fullWidth = false,
  libraryName,
  popoverEnabled = true,
}: {
  item: BaseItemDto;
  serverUrl: string;
  percentageWatched?: number;
  continueWatching?: boolean;
  showProgress?: boolean;
  resumePosition?: number;
  fullWidth?: boolean;
  libraryName?: string;
  popoverEnabled?: boolean;
}) {
  const { playMedia, setIsPlayerVisible } = useMediaPlayer();
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  let linkHref = "";
  if (item.Type === "Movie") {
    linkHref = `/movie/${item.Id}`;
  } else if (item.Type === "Episode") {
    linkHref = `/episode/${item.Id}`;
  } else if (item.Type === "Season") {
    linkHref = `/season/${item.Id}`;
  } else {
    linkHref = `/series/${item.Id}`;
  }

  // Determine image type based on continueWatching
  const imageType = continueWatching ? "Thumb" : "Primary";

  // Determine item ID based on type and continueWatching
  let imageItemId = item.Id;
  if (item.Type === "Episode" && continueWatching) {
    imageItemId = item.ParentThumbItemId || item.Id;
  }

  const [imageLoaded, setImageLoaded] = useState(false);
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
  const [isPlayed, setIsPlayed] = useState(item.UserData?.Played || false);

  // Adjust image URL parameters based on container type
  const imageUrl = continueWatching
    ? `${serverUrl}/Items/${imageItemId}/Images/${imageType}?maxHeight=432&maxWidth=768&quality=100`
    : `${serverUrl}/Items/${imageItemId}/Images/${imageType}?maxHeight=576&maxWidth=384&quality=100`;

  // Generate fallback URLs for different image types
  const fallbackUrls = imageItemId ? generateImageFallbacks(
    serverUrl,
    imageItemId,
    imageType,
    continueWatching ? 432 : 576,
    continueWatching ? 768 : 384,
    100
  ) : [];

  // Get blur hash
  const imageTag =
    item.Type === "Episode"
      ? item.ParentThumbImageTag
      : item.ImageTags?.[imageType]!;
  const blurHash = item.ImageBlurHashes?.[imageType]?.[imageTag!] || "";

  // Decode blur hash
  useEffect(() => {
    if (blurHash && !blurDataUrl) {
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
          setBlurDataUrl(canvas.toDataURL());
        }
      } catch (error) {
        console.error("Error decoding blur hash:", error);
      }
    }
  }, [blurHash, blurDataUrl]);

  // Update isPlayed state when item changes
  useEffect(() => {
    setIsPlayed(item.UserData?.Played || false);
  }, [item.UserData?.Played]);

  // Calculate progress percentage from resume position
  let progressPercentage = percentageWatched;
  if (showProgress && resumePosition && item.RunTimeTicks) {
    progressPercentage = (resumePosition / item.RunTimeTicks) * 100;
  }

  // For continue watching, use landscape aspect ratio and larger width
  const isResumeItem = showProgress && resumePosition;

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (item) {
      await playMedia({
        id: item.Id!,
        name: item.Name!,
        type: item.Type as "Movie" | "Series" | "Episode",
        resumePositionTicks:
          resumePosition || item.UserData?.PlaybackPositionTicks,
      });
      setIsPlayerVisible(true);
    }
  };

  const handleContextualPlay = async () => {
    if (item) {
      await playMedia({
        id: item.Id!,
        name: item.Name!,
        type: item.Type as "Movie" | "Series" | "Episode",
        resumePositionTicks: resumePosition || item.UserData?.PlaybackPositionTicks,
      });
      setIsPlayerVisible(true);
    }
  };

  const handleMarkAsPlayed = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await markItemAsPlayed(item.Id!);
      setIsPlayed(true);
      toast.success("Marked as played");
    } catch (error) {
      toast.error("Failed to mark as played");
    }
  };

  const handleMarkAsUnplayed = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await markItemAsUnplayed(item.Id!);
      setIsPlayed(false);
      toast.success("Marked as unplayed");
    } catch (error) {
      toast.error("Failed to mark as unplayed");
    }
  };

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setPopoverOpen(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setPopoverOpen(false);
  };

  const cardInnerJsx = (
    <>
      <div
        className={`relative w-full border rounded-md overflow-hidden active:scale-[0.98] transition ${continueWatching ? "aspect-video" : "aspect-[2/3]"
          }`}
      >
        <Link
          href={linkHref}
          draggable={false}
          className="block w-full h-full"
        >
          {serverUrl ? (
            <>
              {/* Blur hash placeholder */}
              {blurDataUrl && !imageLoaded && (
                <div
                  className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${progressPercentage > 0 ? "rounded-t-md" : "rounded-md"
                    }`}
                  style={{
                    backgroundImage: `url(${blurDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(0px)",
                  }}
                />
              )}
              {/* Actual image */}
              <RetryImage
                src={imageUrl}
                alt={item.Name || ""}
                className={`w-full h-full object-cover transition-opacity duration-300 shadow-lg shadow-sm group-hover:shadow-md ${progressPercentage > 0 ? "rounded-t-md" : "rounded-md"
                  } opacity-100`}
                fallbackText="No Image"
                maxRetries={3}
                retryDelay={1000}
                fallbackUrls={fallbackUrls}
                onLoad={() => {
                  setImageLoaded(true);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-lg shadow-lg">
              <div className="text-white/60 text-sm">No Image</div>
            </div>
          )}
        </Link>

        {/* Play button overlay */}
        <div
          className={`absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center pointer-events-none ${progressPercentage > 0 ? "rounded-t-md" : "rounded-md"
            }`}
        >
          <div className="invisible group-hover:visible transition-opacity duration-300 pointer-events-auto">
            <button
              onClick={handlePlayClick}
              className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition active:scale-[0.97] hover:cursor-pointer"
            >
              <Play className="h-6 w-6 text-white fill-white" />
            </button>
          </div>
        </div>

        {/* Mark as viewed button */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          {isPlayed ? (
            <button
              onClick={handleMarkAsUnplayed}
              className="bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-105 cursor-pointer"
              title="Mark as unplayed"
            >
              <EyeOff className="h-4 w-4 text-white" />
            </button>
          ) : (
            <button
              onClick={handleMarkAsPlayed}
              className="bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-105 cursor-pointer"
              title="Mark as played"
            >
              <Eye className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        {/* Contextual Actions */}
        <MediaContextualActions
          item={item}
          serverUrl={serverUrl}
          onPlay={handleContextualPlay}
        />

        {/* Progress bar overlay at bottom of image */}
        {progressPercentage > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 overflow-hidden"
            style={{
              borderBottomLeftRadius: "6px",
              borderBottomRightRadius: "6px",
            }}
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
              }}
            ></div>
          </div>
        )}
      </div>
      <Link href={linkHref} draggable={false}>
        <div className="px-1">
          <div className="mt-2.5 text-sm font-medium text-foreground truncate group-hover:underline">
            {item.Name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.Type === "Movie" ||
              item.Type === "Series" ||
              item.Type === "Season"
              ? item.ProductionYear
              : item.SeriesName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.Type === "Episode"
              ? `S${item.ParentIndexNumber} • E${item.IndexNumber}`
              : ""}
          </div>
        </div>
      </Link>
    </>
  );

  if (!popoverEnabled) {
    return (
      <div
        className={`cursor-pointer group overflow-hidden transition select-none ${continueWatching ? "w-96" : fullWidth ? "w-full" : "w-48"
          }`}
      >
        {cardInnerJsx}
      </div>
    );
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`cursor-pointer group overflow-hidden transition select-none ${continueWatching ? "w-96" : fullWidth ? "w-full" : "w-48"
            }`}
        >
          {cardInnerJsx}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="right">
        <div className="grid gap-4">
          <div className="space-y-2">
            {libraryName && <Badge>{libraryName}</Badge>}
            <h4 className="font-medium leading-none">{item.Name}</h4>
            {item.Genres && item.Genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.Genres.map((genre, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {item.Overview && (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <div className="text-sm text-muted-foreground col-span-3">
                  {typeof window !== 'undefined'
                    ? parse(DOMPurify.sanitize(item.Overview))
                    : item.Overview
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
