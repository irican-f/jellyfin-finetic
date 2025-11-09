"use server";

// Helper function to get auth data from cookies
import {cookies} from "next/headers";
import {createJellyfinInstance} from "@/lib/server-utils";
import { getTimeSyncApi } from "@jellyfin/sdk/lib/utils/api";


async function getAuthData() {
    const cookieStore = await cookies();
    const authData = cookieStore.get("jellyfin-auth");

    if (!authData?.value) {
        throw new Error("Not authenticated");
    }

    const parsed = JSON.parse(authData.value);
    return { serverUrl: parsed.serverUrl, user: parsed.user };
}

export async function getUtcTime() {
    try {
        const { serverUrl, user } = await getAuthData();
        const jellyfinInstance = await createJellyfinInstance();
        const api = jellyfinInstance.createApi(serverUrl);
        api.accessToken = user.AccessToken;

        const requestSent = new Date();
        const { data } = await getTimeSyncApi(api).getUtcTime();

        const responseReceived = new Date();
        const responseSent = new Date(data.ResponseTransmissionTime!);
        const requestReceived = new Date(data.RequestReceptionTime!);

        return {
            requestSent: requestSent,
            requestReceived: requestReceived,
            responseSent: responseSent,
            responseReceived: responseReceived
        }
    } catch (error) {
        console.error("Failed to fetch SyncPlay groups:", error);
        throw error;
    }
}