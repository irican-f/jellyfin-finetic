"use client";

import React, { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/media-card";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

interface MediaSectionProps {
  sectionName: string;
  mediaItems: BaseItemDto[] | any[];
  serverUrl: string;
  onViewAll?: () => void;
  isLoading?: boolean;
  continueWatching?: boolean;
  libraryId?: string;
  libraryName?: string;
  popoverEnabled?: boolean;
}

export function MediaSection({
  sectionName,
  mediaItems,
  serverUrl,
  onViewAll,
  isLoading = false,
  continueWatching = false,
  libraryId,
  libraryName,
  popoverEnabled = true,
}: MediaSectionProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the ScrollArea viewport after component mounts
    if (scrollRef.current) {
      const viewport = scrollRef.current.closest('[data-slot="scroll-area"]')?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement;
      if (viewport) {
        viewportRef.current = viewport;
      }
    }
  }, []);

  const scrollLeft = () => {
    if (viewportRef.current) {
      const scrollAmount = viewportRef.current.clientWidth;
      viewportRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (viewportRef.current) {
      const scrollAmount = viewportRef.current.clientWidth;
      viewportRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else if (libraryId) {
      router.push(`/library/${libraryId}`);
    }
  };

  return (
    <section className="relative z-10 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-semibold text-foreground font-poppins">
          {sectionName}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/10 border-border text-foreground hover:bg-accent p-2"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/10 border-border text-foreground hover:bg-accent p-2"
            onClick={scrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/10 border-border text-foreground hover:bg-accent"
            onClick={handleViewAll}
          >
            View All
          </Button>
        </div>
      </div>
      {mediaItems.length > 0 ? (
        <ScrollArea className="w-full pb-6">
          <div className="flex gap-4 w-max" ref={scrollRef}>
            {mediaItems.map((item) => (
              <div key={item.Id} className="flex-shrink-0">
                <MediaCard
                  item={item}
                  serverUrl={serverUrl}
                  percentageWatched={item.UserData?.PlayedPercentage || 0}
                  continueWatching={continueWatching}
                  libraryName={libraryName}
                  popoverEnabled={popoverEnabled}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <Card className="bg-card border-border text-foreground">
          <CardContent className="p-8 text-center">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No {sectionName.toLowerCase()} found in your library
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
