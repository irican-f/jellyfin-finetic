"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { MediaCard } from "@/components/media-card";
import { Loader2 } from "lucide-react";

interface VirtualInfiniteScrollProps {
    libraryId: string;
    serverUrl: string;
    items: BaseItemDto[];
    totalCount: number;
    onLoadMore: () => Promise<void>;
    loading?: boolean;
    hasNextPage?: boolean;
}

export function VirtualInfiniteScroll({
    libraryId,
    serverUrl,
    items,
    totalCount,
    onLoadMore,
    loading = false,
    hasNextPage = true,
}: VirtualInfiniteScrollProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !loading) {
                    onLoadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (loadingRef.current) {
            observer.observe(loadingRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, loading, onLoadMore]);

    return (
        <div className="space-y-4">
            {/* Media Grid */}
            <div
                ref={containerRef}
                className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 auto-rows-max"
            >
                {items.map((item) => (
                    <MediaCard
                        key={item.Id}
                        item={item}
                        serverUrl={serverUrl}
                        fullWidth
                    />
                ))}
            </div>

            {/* Loading indicator */}
            {loading && (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading more items...</span>
                </div>
            )}

            {/* Intersection observer target */}
            {hasNextPage && (
                <div ref={loadingRef} className="h-4" />
            )}

            {/* End of list indicator */}
            {!hasNextPage && items.length > 0 && (
                <div className="flex items-center justify-center py-4">
                    <span className="text-sm text-muted-foreground">
                        All {totalCount} items loaded
                    </span>
                </div>
            )}

            {/* Empty State */}
            {items.length === 0 && !loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="text-muted-foreground text-lg mb-2">
                            No items found
                        </div>
                        <div className="text-muted-foreground text-sm">
                            This library appears to be empty.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

