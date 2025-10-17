'use server';

import { cookies } from 'next/headers';
import { Jellyfin } from "@jellyfin/sdk";
import { ItemsApi } from "@jellyfin/sdk/lib/generated-client/api/items-api";
import { UserLibraryApi } from "@jellyfin/sdk/lib/generated-client/api/user-library-api";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models/base-item-dto";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models/base-item-kind";
import { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import { ItemSortBy } from "@jellyfin/sdk/lib/generated-client/models/item-sort-by";
import { SortOrder } from "@jellyfin/sdk/lib/generated-client/models/sort-order";
import { ItemFilter } from "@jellyfin/sdk/lib/generated-client/models/item-filter";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { ImageType } from "@jellyfin/sdk/lib/generated-client/models/image-type";
import { createJellyfinInstance } from "@/lib/utils";

// Type aliases for easier use
type JellyfinItem = BaseItemDto;


// Helper function to get auth data from cookies
async function getAuthData() {
  const cookieStore = await cookies();
  const authData = cookieStore.get('jellyfin-auth');

  if (!authData?.value) {
    throw new Error('Not authenticated');
  }

  const parsed = JSON.parse(authData.value);
  return { serverUrl: parsed.serverUrl, user: parsed.user };
}

export async function fetchSeasons(tvShowId: string): Promise<JellyfinItem[]> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const itemsApi = new ItemsApi(api.configuration);
    const { data } = await itemsApi.getItems({
      userId: user.Id,
      parentId: tvShowId,
      includeItemTypes: [BaseItemKind.Season],
      recursive: false,
      sortBy: [ItemSortBy.SortName],
      sortOrder: [SortOrder.Ascending],
    });
    return data.Items || [];
  } catch (error) {
    console.error("Failed to fetch seasons:", error);
    return [];
  }
}

export async function fetchEpisodes(seasonId: string): Promise<JellyfinItem[]> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const itemsApi = new ItemsApi(api.configuration);
    const { data } = await itemsApi.getItems({
      userId: user.Id,
      parentId: seasonId,
      includeItemTypes: [BaseItemKind.Episode],
      recursive: false,
      sortBy: [ItemSortBy.SortName],
      sortOrder: [SortOrder.Ascending],
      fields: [
        ItemFields.CanDelete,
        ItemFields.PrimaryImageAspectRatio,
        ItemFields.Overview,
        ItemFields.MediaSources,
      ],
    });
    return data.Items || [];
  } catch (error) {
    console.error("Failed to fetch episodes:", error);
    return [];
  }
}

export async function fetchTVShowDetails(tvShowId: string): Promise<JellyfinItem | null> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const userLibraryApi = new UserLibraryApi(api.configuration);
    const { data } = await userLibraryApi.getItem({
      userId: user.Id,
      itemId: tvShowId,
    });
    return data;
  } catch (error) {
    console.error("Failed to fetch TV show details:", error);
    return null;
  }
}

export async function fetchEpisodeDetails(episodeId: string): Promise<JellyfinItem | null> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const userLibraryApi = new UserLibraryApi(api.configuration);
    const { data } = await userLibraryApi.getItem({
      userId: user.Id,
      itemId: episodeId,
    });
    return data;
  } catch (error) {
    console.error("Failed to fetch episode details:", error);
    return null;
  }
}

export async function getNextEpisodeForSeries(seriesId: string): Promise<JellyfinItem | null> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const itemsApi = getItemsApi(api);

    // Get all episodes for the series with user data
    const { data } = await itemsApi.getItems({
      userId: user.Id,
      parentId: seriesId,
      includeItemTypes: [BaseItemKind.Episode],
      recursive: true,
      sortBy: [ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber],
      sortOrder: [SortOrder.Ascending, SortOrder.Ascending],
      fields: [
        ItemFields.CanDelete,
        ItemFields.PrimaryImageAspectRatio,
        ItemFields.Overview,
        ItemFields.MediaSources,
      ],
    });

    if (!data.Items || data.Items.length === 0) {
      return null;
    }

    // First, look for episodes with resume positions (partially watched)
    const resumableEpisodes = data.Items.filter(episode =>
      episode.UserData?.PlaybackPositionTicks &&
      episode.UserData.PlaybackPositionTicks > 0 &&
      !episode.UserData.Played
    );

    if (resumableEpisodes.length > 0) {
      // Return the most recently partially watched episode
      return resumableEpisodes[0];
    }

    // If no resumable episodes, find the first unwatched episode
    const unwatchedEpisodes = data.Items.filter(episode =>
      !episode.UserData?.Played
    );

    if (unwatchedEpisodes.length > 0) {
      return unwatchedEpisodes[0];
    }

    // If all episodes are watched, return the first episode for rewatching
    return data.Items[0] || null;
  } catch (error) {
    console.error("Failed to get next episode for series:", error);
    return null;
  }
}

export async function fetchEpisodesForCurrentSeason(episodeId: string): Promise<JellyfinItem[]> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const itemsApi = new ItemsApi(api.configuration);

    // First get the current episode details to find the season
    const { data: episodeData } = await itemsApi.getItems({
      userId: user.Id,
      ids: [episodeId],
      fields: [ItemFields.Overview, ItemFields.MediaSources],
    });

    if (!episodeData.Items || episodeData.Items.length === 0) {
      return [];
    }

    const currentEpisode = episodeData.Items[0];
    const seriesId = currentEpisode.SeriesId;
    const seasonNumber = currentEpisode.ParentIndexNumber;

    if (!seriesId || seasonNumber === undefined) {
      return [];
    }

    // Get all episodes for the series
    const { data } = await itemsApi.getItems({
      userId: user.Id,
      parentId: seriesId,
      includeItemTypes: [BaseItemKind.Episode],
      recursive: true,
      sortBy: [ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber],
      sortOrder: [SortOrder.Ascending, SortOrder.Ascending],
      fields: [
        ItemFields.CanDelete,
        ItemFields.PrimaryImageAspectRatio,
        ItemFields.Overview,
        ItemFields.MediaSources,
      ],
    });

    if (!data.Items || data.Items.length === 0) {
      return [];
    }

    // Filter episodes for the current season
    const seasonEpisodes = data.Items.filter(episode =>
      episode.ParentIndexNumber === seasonNumber
    );

    return seasonEpisodes;
  } catch (error) {
    console.error("Failed to fetch episodes for current season:", error);
    return [];
  }
}

export async function fetchNextUpItems(limit: number = 24): Promise<JellyfinItem[]> {
  try {
    const { serverUrl, user } = await getAuthData();
    const jellyfinInstance = createJellyfinInstance();
    const api = jellyfinInstance.createApi(serverUrl);
    api.accessToken = user.AccessToken;

    const tvShowsApi = getTvShowsApi(api);

    const { data } = await tvShowsApi.getNextUp({
      userId: user.Id,
      limit,
      fields: [
        ItemFields.PrimaryImageAspectRatio,
        ItemFields.DateCreated,
        ItemFields.Path,
        ItemFields.MediaSources,
      ],
      imageTypeLimit: 1,
      enableImageTypes: [
        ImageType.Primary,
        ImageType.Backdrop,
        ImageType.Banner,
        ImageType.Thumb,
      ],
      enableTotalRecordCount: false,
      disableFirstEpisode: false,
      enableResumable: false,
      enableRewatching: false,
      // Remove nextUpDateCutoff to get all shows the user has started watching
    });

    const items = data.Items || [];

    // Filter out excluded series
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const excludedSeries = cookieStore.get("excluded-from-next-up");
    let excludedList: string[] = [];

    if (excludedSeries?.value) {
      try {
        excludedList = JSON.parse(excludedSeries.value);
        console.log("Excluded series list:", excludedList);
      } catch (error) {
        console.error("Failed to parse excluded series in fetchNextUpItems:", error);
        excludedList = [];
      }
    } else {
      console.log("No excluded series cookie found");
    }

    // Filter out episodes from excluded series
    const filteredItems = items.filter(item => {
      if (item.Type === "Episode" && item.SeriesId) {
        const isExcluded = excludedList.includes(item.SeriesId);
        if (isExcluded) {
          console.log("Filtering out episode from excluded series:", item.SeriesId, item.Name);
        }
        return !isExcluded;
      }
      return true;
    });

    console.log(`Filtered ${items.length} items to ${filteredItems.length} items`);

    return filteredItems;
  } catch (error) {
    console.error("Failed to fetch next up items:", error);
    return [];
  }
}
