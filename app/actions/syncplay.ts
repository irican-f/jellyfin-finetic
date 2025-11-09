"use server";

import { cookies } from "next/headers";
import { createJellyfinInstance } from "@/lib/server-utils";
import { GroupInfoDto, QueueRequestDto, BufferRequestDto, SeekRequestDto, ReadyRequestDto, NewGroupRequestDto, JoinGroupRequestDto, GroupQueueMode } from "@jellyfin/sdk/lib/generated-client";
import { getSyncPlayApi } from "@jellyfin/sdk/lib/utils/api";
import { AxiosError } from "axios";

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

// REST API Functions

export async function getSyncPlayGroups(): Promise<GroupInfoDto[]> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const response = await getSyncPlayApi(api).syncPlayGetGroups();

        return response.data;
    } catch (error) {
        console.error("Failed to fetch SyncPlay groups:", error);
        throw error;
    }
}

export async function getSyncPlayGroupById(groupId: string): Promise<GroupInfoDto | null> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const response = await getSyncPlayApi(api).syncPlayGetGroups();
        const group = response.data.find(g => g.GroupId === groupId);
        return group || null;
    } catch (error) {
        console.error("Failed to fetch SyncPlay group:", error);
        if (error instanceof Error && error.message.includes('404')) {
            return null;
        }
        throw error;
    }
}

export async function createSyncPlayGroup(groupName: string): Promise<GroupInfoDto> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: NewGroupRequestDto = {
            GroupName: groupName,
        };

        await getSyncPlayApi(api).syncPlayCreateGroup({ newGroupRequestDto: requestBody });
        // Return the created group by fetching the updated list
        const groupsResponse = await getSyncPlayApi(api).syncPlayGetGroups();
        const createdGroup = groupsResponse.data.find(g => g.GroupName === groupName);
        if (!createdGroup) {
            throw new Error('Failed to retrieve created group');
        }
        return createdGroup;
    } catch (error) {
        console.error("Failed to create SyncPlay group:", error);
        throw error;
    }
}

export async function joinSyncPlayGroup(groupId: string): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: JoinGroupRequestDto = {
            GroupId: groupId,
        };

        await getSyncPlayApi(api).syncPlayJoinGroup({ joinGroupRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to join SyncPlay group:", error);
        throw error;
    }
}

export async function leaveSyncPlayGroup(): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        await getSyncPlayApi(api).syncPlayLeaveGroup();

        console.log("SyncPlay group left");
    } catch (error) {
        console.error("Failed to leave SyncPlay group:", error);
        throw error;
    }
}

export async function syncPlayPause(): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        await getSyncPlayApi(api).syncPlayPause();
    } catch (error) {
        console.error("Failed to pause SyncPlay:", error);
        throw error;
    }
}

export async function syncPlayUnpause(): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        await getSyncPlayApi(api).syncPlayUnpause();
    } catch (error) {
        console.error("Failed to unpause SyncPlay:", error);
        throw error;
    }
}

export async function syncPlayStop(): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        await getSyncPlayApi(api).syncPlayStop();
    } catch (error) {
        console.error("Failed to stop SyncPlay:", error);
        throw error;
    }
}

export async function syncPlaySeek(positionTicks: number): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: SeekRequestDto = {
            PositionTicks: positionTicks,
        };

        await getSyncPlayApi(api).syncPlaySeek({ seekRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to seek SyncPlay:", error);
        throw error;
    }
}

export async function syncPlayBuffering(isBuffering: boolean, positionTicks: number, playlistItemId: string | null): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: BufferRequestDto = {
            When: new Date().toISOString(),
            PositionTicks: positionTicks,
            IsPlaying: !isBuffering,
        };

        if (playlistItemId) {
            requestBody.PlaylistItemId = playlistItemId;
        }

        await getSyncPlayApi(api).syncPlayBuffering({ bufferRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to send buffering state:", error);
        throw error;
    }
}

export async function syncPlayReady(isReady: boolean, positionTicks: number, playlistItemId: string | null): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: ReadyRequestDto = {
            When: new Date().toISOString(),
            PositionTicks: positionTicks,
            IsPlaying: isReady,
        };

        if (playlistItemId) {
            requestBody.PlaylistItemId = playlistItemId;
        }

        await getSyncPlayApi(api).syncPlayReady({ readyRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to send ready state:", error);
        throw error;
    }
}

export async function syncPlayQueue(itemIds: string[], mode: GroupQueueMode = "QueueNext"): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody: QueueRequestDto = {
            ItemIds: itemIds,
            Mode: mode,
        };

        await getSyncPlayApi(api).syncPlayQueue({ queueRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to queue items:", error);
        throw error;
    }
}

export async function syncPlaySetNewQueue(itemIds: string[], startPosition: number = 0): Promise<void> {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestBody = {
            ItemIds: itemIds,
            StartPositionTicks: startPosition,
        };

        await getSyncPlayApi(api).syncPlaySetNewQueue({ playRequestDto: requestBody });
    } catch (error) {
        console.error("Failed to set new queue:", error);
        throw error;
    }
}

export async function syncPlayPing(ping: number) {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        // Round ping to integer as server expects Int64
        const pingInt = Math.round(ping);

        const requestBody = {
            Ping: pingInt
        };

        await getSyncPlayApi(api).syncPlayPing({ pingRequestDto: requestBody });
    } catch (error: any) {
        console.error("Failed to send ping:", error.response?.data);
        throw error;
    }
}