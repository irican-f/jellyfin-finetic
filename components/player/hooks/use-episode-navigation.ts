import { useState, useCallback } from 'react';
import { JellyfinItem } from "@/types/jellyfin";
import { MediaToPlay } from '@/lib/atoms';
import { 
    fetchEpisodesForCurrentSeason, 
    getNextEpisode, 
    getPreviousEpisode 
} from "@/app/actions";

export function useEpisodeNavigation(currentMedia: MediaToPlay | null) {
    const [nextEpisode, setNextEpisode] = useState<JellyfinItem | null>(null);
    const [previousEpisode, setPreviousEpisode] = useState<JellyfinItem | null>(null);
    const [seasonEpisodes, setSeasonEpisodes] = useState<JellyfinItem[]>([]);

    const loadEpisodeNavigation = useCallback(async () => {
        if (!currentMedia || currentMedia.type !== "Episode") {
            setNextEpisode(null);
            setPreviousEpisode(null);
            setSeasonEpisodes([]);
            return;
        }

        try {
            const [next, previous, episodes] = await Promise.all([
                getNextEpisode(currentMedia.id),
                getPreviousEpisode(currentMedia.id),
                fetchEpisodesForCurrentSeason(currentMedia.id),
            ]);

            setNextEpisode(next);
            setPreviousEpisode(previous);
            setSeasonEpisodes(episodes);
        } catch (error) {
            console.error("Failed to load episode navigation:", error);
            setNextEpisode(null);
            setPreviousEpisode(null);
            setSeasonEpisodes([]);
        }
    }, [currentMedia]);

    return {
        nextEpisode,
        previousEpisode,
        seasonEpisodes,
        loadEpisodeNavigation
    };
}

