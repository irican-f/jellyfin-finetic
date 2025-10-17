"use client";

import React from "react";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import { RetryImage } from "@/components/ui/retry-image";
import { generateImageFallbacks } from "@/lib/image-fallbacks";

interface ContinueWatchingCardProps {
  item: BaseItemDto;
  serverUrl: string;
}

export function ContinueWatchingCard({ item, serverUrl }: ContinueWatchingCardProps) {
  const { playMedia, setIsPlayerVisible } = useMediaPlayer();

  // Calculate progress percentage from resume position
  let progressPercentage = 0;
  if (item.UserData?.PlaybackPositionTicks && item.RunTimeTicks) {
    progressPercentage = (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100;
  }

  // Use backdrop/thumb image for landscape view
  const imageType = "Primary";
  const imageUrl = `${serverUrl}/Items/${item.Id}/Images/${imageType}`;

  // Generate fallback URLs for different image types
  const fallbackUrls = item.Id ? generateImageFallbacks(serverUrl, item.Id, imageType) : [];

  const handlePlayResume = async () => {
    if (item) {
      await playMedia({
        id: item.Id!,
        name: item.Name!,
        type: item.Type as "Movie" | "Series" | "Episode",
        resumePositionTicks: item.UserData?.PlaybackPositionTicks,
      });
      setIsPlayerVisible(true);
    }
  };

  return (
    <div
      onClick={handlePlayResume}
      className="cursor-pointer group overflow-hidden transition select-none w-64"
    >
      <div className="relative w-full aspect-video">
        {serverUrl ? (
          <RetryImage
            src={imageUrl}
            alt={item.Name || "Media item"}
            className="w-full h-full"
            fallbackText="No Image"
            maxRetries={3}
            retryDelay={1000}
            fallbackUrls={fallbackUrls}
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-lg shadow-lg">
            <div className="text-white/60 text-sm">No Image</div>
          </div>
        )}

        {/* Progress bar overlay at bottom of image */}
        {progressPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 backdrop-blur-sm">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
              }}
            ></div>
          </div>
        )}
      </div>

      <div className="px-1">
        <div className="mt-2.5 text-sm font-medium text-foreground truncate group-hover:underline">
          {item.Name}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.Type === "Movie" || item.Type === "Series"
            ? item.ProductionYear
            : item.SeriesName}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.Type === "Episode"
            ? `S${item.ParentIndexNumber} • E${item.IndexNumber}`
            : ""}
        </div>
      </div>
    </div>
  );
}
