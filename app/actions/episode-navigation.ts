'use server';

import { cookies } from "next/headers";
import { Jellyfin } from "@jellyfin/sdk";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models/base-item-dto";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models/base-item-kind";
import { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import { ItemSortBy } from "@jellyfin/sdk/lib/generated-client/models/item-sort-by";
import { SortOrder } from "@jellyfin/sdk/lib/generated-client/models/sort-order";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { createJellyfinInstance } from "@/lib/server-utils";
import { fetchMediaDetails } from "./media";

// Type aliases for easier use
type JellyfinItem = BaseItemDto;

// Helper function to get auth data from cookies
async function getAuthData() {
    const cookieStore = await cookies();
    const authData = cookieStore.get("jellyfin-auth");

    if (!authData?.value) {
        throw new Error("Not authenticated");
    }

    const parsed = JSON.parse(authData.value);
    return { serverUrl: parsed.serverUrl, user: parsed.user };
}

export async function getNextEpisode(currentEpisodeId: string): Promise<JellyfinItem | null> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        // Get current episode details
        const currentEpisode = await fetchMediaDetails(currentEpisodeId);
        if (!currentEpisode || currentEpisode.Type !== "Episode" || !currentEpisode.SeriesId) {
            return null;
        }

        const itemsApi = getItemsApi(api);

        // Get all episodes for the series
        const { data } = await itemsApi.getItems({
            userId: user.Id,
            parentId: currentEpisode.SeriesId,
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

        // Find current episode index
        const currentIndex = data.Items.findIndex(episode => episode.Id === currentEpisodeId);
        if (currentIndex === -1 || currentIndex === data.Items.length - 1) {
            return null; // Current episode not found or is the last episode
        }

        // Return next episode
        return data.Items[currentIndex + 1];
    } catch (error) {
        console.error("Failed to get next episode:", error);
        return null;
    }
}

export async function getPreviousEpisode(currentEpisodeId: string): Promise<JellyfinItem | null> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        // Get current episode details
        const currentEpisode = await fetchMediaDetails(currentEpisodeId);
        if (!currentEpisode || currentEpisode.Type !== "Episode" || !currentEpisode.SeriesId) {
            return null;
        }

        const itemsApi = getItemsApi(api);

        // Get all episodes for the series
        const { data } = await itemsApi.getItems({
            userId: user.Id,
            parentId: currentEpisode.SeriesId,
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

        // Find current episode index
        const currentIndex = data.Items.findIndex(episode => episode.Id === currentEpisodeId);
        if (currentIndex <= 0) {
            return null; // Current episode not found or is the first episode
        }

        // Return previous episode
        return data.Items[currentIndex - 1];
    } catch (error) {
        console.error("Failed to get previous episode:", error);
        return null;
    }
}

