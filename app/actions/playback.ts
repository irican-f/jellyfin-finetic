"use server";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models/base-item-kind";
import { ItemSortBy } from "@jellyfin/sdk/lib/generated-client/models/item-sort-by";
import { SortOrder } from "@jellyfin/sdk/lib/generated-client/models/sort-order";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createJellyfinInstance } from "@/lib/utils";
import {MediaInfoApiGetPlaybackInfoRequest, PlaybackInfoResponse} from "@jellyfin/sdk/lib/generated-client";
import {getMediaInfoApi} from "@jellyfin/sdk/lib/utils/api";

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

export async function markItemAsPlayed(itemId: string): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const datePlayed = new Date().toISOString();
        const { data } = await getPlaystateApi(api).markPlayedItem({
            userId: user.Id,
            itemId,
            datePlayed,
        });

        // Trigger a refresh of the Next Up section
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to mark item as played:", error);
        throw error;
    }
}

export async function markItemAsUnplayed(itemId: string): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const { data } = await getPlaystateApi(api).markUnplayedItem({
            userId: user.Id,
            itemId,
        });

        // Trigger a refresh of the Next Up section
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to mark item as unplayed:", error);
        throw error;
    }
}

export async function removeFromNextUp(seriesId: string): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        // Store the series ID in a cookie to exclude it from Next Up
        // This is a client-side workaround for Jellyfin's Next Up API limitations
        const cookieStore = await cookies();
        const excludedSeries = cookieStore.get("excluded-from-next-up");
        let excludedList: string[] = [];

        if (excludedSeries?.value) {
            try {
                excludedList = JSON.parse(excludedSeries.value);
            } catch (error) {
                console.error("Failed to parse excluded series:", error);
                excludedList = [];
            }
        }

        if (!excludedList.includes(seriesId)) {
            excludedList.push(seriesId);
            console.log("Adding series to exclusion list:", seriesId, "Total excluded:", excludedList.length);

            // Use the same cookie settings as the auth cookie
            try {
                cookieStore.set("excluded-from-next-up", JSON.stringify(excludedList), {
                    path: "/",
                    maxAge: 60 * 60 * 24 * 365,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                });
                console.log("Cookie set successfully");
            } catch (cookieError) {
                console.error("Failed to set cookie:", cookieError);
            }
        } else {
            console.log("Series already excluded:", seriesId);
        }

        // Trigger a refresh of the Next Up section by invalidating the cache
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to clear series progress:", error);
        throw error;
    }
}

export async function restoreSeriesToNextUp(seriesId: string): Promise<void> {
    try {
        const cookieStore = await import("next/headers").then(m => m.cookies());
        const excludedSeries = cookieStore.get("excluded-from-next-up");
        let excludedList: string[] = [];

        if (excludedSeries?.value) {
            try {
                excludedList = JSON.parse(excludedSeries.value);
            } catch (error) {
                excludedList = [];
            }
        }

        // Remove the series from the excluded list
        const updatedList = excludedList.filter(id => id !== seriesId);

        if (updatedList.length > 0) {
            cookieStore.set("excluded-from-next-up", JSON.stringify(updatedList), {
                path: "/",
                maxAge: 60 * 60 * 24 * 365,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            });
        } else {
            cookieStore.delete("excluded-from-next-up");
        }

        // Trigger a refresh of the Next Up section by invalidating the cache
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to restore series to Next Up:", error);
        throw error;
    }
}

export async function getPlaybackInfo(
    itemId: string,
): Promise<PlaybackInfoResponse> {
    const { serverUrl, user } = await getAuthData();
    const jellyfinInstance = createJellyfinInstance();
    const api = jellyfinInstance.createApi(serverUrl);
    api.accessToken = user.AccessToken;

    try {
        const mediaInfoApi = getMediaInfoApi(api);

        const playbackInfoRequest = {
            itemId: itemId,
            userId: user.Id,
        } as MediaInfoApiGetPlaybackInfoRequest;

        const response = await mediaInfoApi.getPlaybackInfo(playbackInfoRequest);
        return response.data;
    } catch (error) {
        console.error("Failed to get playback info:", error);
        throw error;
    }
}