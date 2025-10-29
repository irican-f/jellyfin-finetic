"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Film,
  Tv,
  Calendar,
  PlayCircle,
  Star,
  User,
  LayoutGrid,
  List,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  searchItems,
  getImageUrl,
  getUser,
  logout,
  getServerUrl,
} from "@/app/actions";
import { Badge } from "./ui/badge";
import { SearchSuggestionItem } from "./search-suggestion-item";
import { TextShimmerWave } from "./ui/text-shimmer-wave";
import { useMediaPlayer } from "@/contexts/MediaPlayerContext";
import * as Kbd from "@/components/ui/kbd";
import { TextShimmer } from "./motion-primitives/text-shimmer";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MediaCard } from "./media-card";
import { useAtom } from "jotai";
import { searchDisplayModeAtom } from "@/lib/atoms";

interface SearchBarProps {
  className?: string;
}

// Types de filtres disponibles avec leurs configurations
const FILTER_TYPES = [
  {
    type: "All",
    icon: Search,
    label: "All",
    hoverClass: "hover:bg-slate-600",
    focusClass: "focus:outline-slate-500",
    activeClass: "active:bg-slate-700",
    activeStateClass: "bg-slate-600 text-white ring-2 ring-slate-400",
    iconColor: "text-slate-400",
  },
  {
    type: "Movie",
    icon: Film,
    label: "Movie",
    hoverClass: "hover:bg-blue-600",
    focusClass: "focus:outline-blue-500",
    activeClass: "active:bg-blue-700",
    activeStateClass: "bg-blue-600 text-white ring-2 ring-blue-400",
    iconColor: "text-blue-400",
  },
  {
    type: "Series",
    icon: Tv,
    label: "Series",
    hoverClass: "hover:bg-emerald-600",
    focusClass: "focus:outline-emerald-500",
    activeClass: "active:bg-emerald-700",
    activeStateClass: "bg-emerald-600 text-white ring-2 ring-emerald-400",
    iconColor: "text-emerald-400",
  },
  {
    type: "Anime",
    icon: Tv,
    label: "Anime",
    hoverClass: "hover:bg-yellow-600",
    focusClass: "focus:outline-yellow-500",
    activeClass: "active:bg-yellow-700",
    activeStateClass: "bg-yellow-600 text-white ring-2 ring-yellow-400",
    iconColor: "text-yellow-400",
  },
  {
    type: "Person",
    icon: User,
    label: "Person",
    hoverClass: "hover:bg-purple-600",
    focusClass: "focus:outline-purple-500",
    activeClass: "active:bg-purple-700",
    activeStateClass: "bg-purple-600 text-white ring-2 ring-purple-400",
    iconColor: "text-purple-400",
  },
  {
    type: "Episode",
    icon: PlayCircle,
    label: "Episode",
    hoverClass: "hover:bg-orange-600",
    focusClass: "focus:outline-orange-500",
    activeClass: "active:bg-orange-700",
    activeStateClass: "bg-orange-600 text-white ring-2 ring-orange-400",
    iconColor: "text-orange-400",
  },
] as const;

export function SearchBar({ className = "" }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [displayMode, setDisplayMode] = useAtom(searchDisplayModeAtom);
  const router = useRouter();
  const { isPlayerVisible } = useMediaPlayer();
  // Server actions are imported directly
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { serverUrl } = useAuth();

  // Memoized loading component to prevent re-rendering while typing, animation restarts every time without memoization
  const loadingComponent = useMemo(
    () => (
      <div className="flex justify-center items-center p-8">
        <TextShimmer className="text-sm font-mono">
          {`Searching ${
            serverUrl &&
            new URL(serverUrl).hostname.replace(/^(jellyfin\.|www\.)/, "")
          }...`}
        </TextShimmer>
      </div>
    ),
    [serverUrl]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.trim().length > 2) {
      setIsLoading(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchItems(searchQuery.trim());
          // Sort to prioritize Movies and Series over Episodes and People
          const sortedResults = results.sort((a, b) => {
            const typePriority = { Movie: 1, Series: 2, Person: 3, Episode: 4 };
            const aPriority =
              typePriority[a.Type as keyof typeof typePriority] || 5;
            const bPriority =
              typePriority[b.Type as keyof typeof typePriority] || 5;
            return aPriority - bPriority;
          });
          setSuggestions(sortedResults.slice(0, 10)); // Limit to 10 suggestions
          setShowSuggestions(true);
        } catch (error) {
          console.error("Search failed:", error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, searchItems]);

  // Global keyboard shortcut for search activation
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only activate on slash key if no input is focused and no modifiers are pressed
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !document.activeElement?.hasAttribute("contenteditable")
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (item: any) => {
    setShowSuggestions(false);

    if (item.Type === "Episode") {
      // For episodes, navigate to the search page for now as SeriesId is not directly available
      router.push(`/search?q=${encodeURIComponent(item.Name)}`);
    } else {
      router.push(`/${item.Type.toLowerCase()}/${item.Id}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim().length > 2) {
      setShowSuggestions(true);
    }
  };

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(filterType);
  };

  const getFilteredSuggestions = () => {
    if (!activeFilter || activeFilter === "All") {
      return suggestions;
    }

    if (activeFilter === "Series") {
      return suggestions.filter(
        (item) => item.ParentId === "f4dda38cd82a250f2d1cb08db0c166cf"
      );
    }
    if (activeFilter === "Anime") {
      return suggestions.filter(
        (item) => item.ParentId === "d6edfc0f3c217d4de0ef70c69ee83a8c"
      );
    }

    return suggestions.filter((item) => item.Type === activeFilter);
  };

  const formatRuntime = (runTimeTicks?: number) => {
    if (!runTimeTicks) return null;
    const totalMinutes = Math.round(runTimeTicks / 600000000); // Convert from ticks to minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Hide the search bar when media player is visible
  if (isPlayerVisible) {
    return null;
  }

  return (
    <div
      className={`relative z-[9999] w-6xl ${className}`}
      ref={suggestionsRef}
    >
      <form onSubmit={handleSearch} className="flex gap-2">
        {/* Mobile Navigation Trigger - Only visible on mobile */}
        <div className="md:hidden">
          <SidebarTrigger className="dark:bg-background/70! bg-background/90 border-border border text-foreground hover:bg-accent rounded-2xl h-11 w-11 p-0 backdrop-blur-sm" />
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search movies, TV shows, episodes, and people..."
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => {
              if (searchQuery.trim().length > 2 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            className="pl-10 pr-16 border-border text-foreground placeholder:text-muted-foreground h-11 rounded-2xl md:rounded-xl backdrop-blur-md dark:bg-background/70! bg-background/90"
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10">
            <Kbd.Root variant="outline" size="lg">
              <Kbd.Key>/</Kbd.Key>
            </Kbd.Root>
          </div>
        </div>
      </form>

      {/* Search Suggestions Dropdown */}
      {(showSuggestions || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 dark:bg-background/70! bg-background/90 backdrop-blur-md rounded-xl border shadow-xl shadow-accent/30 z-[9999] overflow-y-auto">
          {isLoading && loadingComponent}

          {!isLoading && suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-muted-foreground flex gap-3 px-2 py-1 mb-2 items-center">
                <span className="text-sm font-medium">Type</span>
                {FILTER_TYPES.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = activeFilter === filter.type;
                  return (
                    <Button
                      key={filter.type}
                      variant="secondary"
                      onClick={() => handleFilterClick(filter.type)}
                      className={`${
                        filter.hoverClass
                      } focus:outline-2 focus:outline-offset-2 ${
                        filter.focusClass
                      } ${filter.activeClass} transition-all ${
                        isActive ? filter.activeStateClass : ""
                      }`}
                    >
                      <Icon className={filter.iconColor} />
                      {filter.label}
                    </Button>
                  );
                })}
                <div className="flex gap-2 ml-auto items-center">
                  <Button
                    variant={displayMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDisplayMode("list")}
                    className="gap-2"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={displayMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDisplayMode("grid")}
                    className="gap-2"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {getFilteredSuggestions().length > 0 ? (
                displayMode === "grid" ? (
                  <div className="grid grid-cols-6 grid-rows-auto gap-4">
                    {getFilteredSuggestions().map((item) => (
                      <MediaCard
                        key={item.Id}
                        item={item}
                        serverUrl={serverUrl || ""}
                        fullWidth
                        withDescription={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div>
                    {getFilteredSuggestions().map((item) => (
                      <SearchSuggestionItem
                        key={item.Id}
                        item={item}
                        onClick={() => handleSuggestionClick(item)}
                        formatRuntime={formatRuntime}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>
                    Aucun résultat de ce type pour &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {!isLoading &&
            suggestions.length === 0 &&
            searchQuery.trim().length > 2 && (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
