"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { VirtualInfiniteScroll } from "@/components/virtual-infinite-scroll";
import { fetchLibraryItemsPage } from "@/app/actions/media";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronDown,
    Search,
    Type,
    Dice6,
    Star,
    ThumbsUp,
    Calendar,
    CalendarDays,
    Clock,
    ArrowUp,
    ArrowDown,
    Dices
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SortField = {
    value: string;
    label: string;
    getSortValue: (item: BaseItemDto) => number | string;
    isDate?: boolean;
};

type SortOrder = 'asc' | 'desc';

// Icon mapping for sort fields
const getSortFieldIcon = (fieldValue: string) => {
    const iconMap = {
        "SortName": Type,
        "Random": Dice6,
        "CommunityRating": Star,
        "CriticRating": ThumbsUp,
        "DateCreated": Calendar,
        "PremiereDate": CalendarDays,
        "Runtime": Clock,
        "ProductionYear": Calendar,
    };
    return iconMap[fieldValue as keyof typeof iconMap] || Type;
};

// Icon mapping for sort orders
const getSortOrderIcon = (orderValue: SortOrder) => {
    return orderValue === 'asc' ? ArrowUp : ArrowDown;
};

const sortFields: SortField[] = [
    {
        value: "SortName",
        label: "Name",
        getSortValue: (item) => item.Name || "",
    },
    {
        value: "Random",
        label: "Random",
        getSortValue: () => Math.random(),
    },
    {
        value: "CommunityRating",
        label: "Community Rating",
        getSortValue: (item) => item.CommunityRating || 0,
    },
    {
        value: "CriticRating",
        label: "Critics Rating",
        getSortValue: (item) => item.CriticRating || 0,
    },
    {
        value: "DateCreated",
        label: "Date Added",
        getSortValue: (item) => item.DateCreated ? new Date(item.DateCreated).getTime() : 0,
        isDate: true,
    },
    {
        value: "PremiereDate",
        label: "Release Date",
        getSortValue: (item) => item.PremiereDate ? new Date(item.PremiereDate).getTime() : 0,
        isDate: true,
    },
    {
        value: "Runtime",
        label: "Runtime",
        getSortValue: (item) => item.RunTimeTicks || 0,
    },
    {
        value: "ProductionYear",
        label: "Year",
        getSortValue: (item) => item.ProductionYear || 0,
    },
];

const sortOrders = [
    { value: 'asc' as SortOrder, label: 'Ascending' },
    { value: 'desc' as SortOrder, label: 'Descending' },
];

interface LibraryMediaListVirtualProps {
    libraryId: string;
    mediaItems: BaseItemDto[];
    totalCount: number;
    serverUrl: string;
}

export function LibraryMediaListVirtual({
    libraryId,
    mediaItems,
    totalCount,
    serverUrl,
}: LibraryMediaListVirtualProps) {
    const [items, setItems] = useState<BaseItemDto[]>(mediaItems);
    const [loading, setLoading] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(mediaItems.length < totalCount);

    // Sorting and filtering state
    const [sortField, setSortField] = useState<string>("SortName");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [rerollTrigger, setRerollTrigger] = useState<number>(0);

    // Function to trigger a reroll for random sorting
    const handleReroll = () => {
        setRerollTrigger(prev => prev + 1);
    };

    // Reset items when sort/search changes
    useEffect(() => {
        const loadInitialItems = async () => {
            setLoading(true);
            try {
                const newItems = await fetchLibraryItemsPage(libraryId, 0, 50, sortField, sortOrder, searchQuery);
                setItems(newItems);
                setHasNextPage(newItems.length < totalCount);
            } catch (error) {
                console.error("Failed to load initial items:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialItems();
    }, [sortField, sortOrder, searchQuery, rerollTrigger, libraryId, totalCount]);

    const loadMore = useCallback(async () => {
        if (loading || !hasNextPage) return;

        setLoading(true);
        try {
            const newItems = await fetchLibraryItemsPage(libraryId, items.length, 50, sortField, sortOrder, searchQuery);
            if (newItems.length > 0) {
                setItems(prev => [...prev, ...newItems]);
                setHasNextPage(items.length + newItems.length < totalCount);
            } else {
                setHasNextPage(false);
            }
        } catch (error) {
            console.error("Failed to load more items:", error);
            setHasNextPage(false);
        } finally {
            setLoading(false);
        }
    }, [libraryId, items.length, totalCount, loading, hasNextPage, sortField, sortOrder, searchQuery]);

    const selectedFieldLabel = sortFields.find((field) => field.value === sortField)?.label || "Name";
    const selectedOrderLabel = sortOrders.find((order) => order.value === sortOrder)?.label || "Ascending";
    const SelectedFieldIcon = getSortFieldIcon(sortField);
    const SelectedOrderIcon = getSortOrderIcon(sortOrder);

    return (
        <div className="space-y-4">
            {/* Search and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Search media..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                    {/* Sort Field Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <SelectedFieldIcon className="h-4 w-4" />
                                Sort: {selectedFieldLabel}
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {sortFields.map((field) => {
                                const FieldIcon = getSortFieldIcon(field.value);
                                return (
                                    <DropdownMenuItem
                                        key={field.value}
                                        onClick={() => setSortField(field.value)}
                                        className={`gap-2 ${sortField === field.value ? "bg-accent" : ""}`}
                                    >
                                        <FieldIcon className="h-4 w-4" />
                                        {field.label}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort Order Button - Hide for Random */}
                    {sortField !== "Random" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        >
                            <SelectedOrderIcon className="h-4 w-4" />
                            {selectedOrderLabel}
                        </Button>
                    )}

                    {/* Reroll Button - Show only for Random */}
                    {sortField === "Random" && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleReroll}
                                        className="gap-2"
                                    >
                                        <Dices className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Reroll</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* Virtual Infinite Scroll */}
            <VirtualInfiniteScroll
                libraryId={libraryId}
                serverUrl={serverUrl}
                items={items}
                totalCount={totalCount}
                onLoadMore={loadMore}
                loading={loading}
                hasNextPage={hasNextPage}
            />
        </div>
    );
}
