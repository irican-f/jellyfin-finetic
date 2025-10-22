"use server";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createJellyfinInstance } from "@/lib/server-utils";
import { MediaInfoApiGetPlaybackInfoRequest, MediaInfoApiGetPostedPlaybackInfoRequest, PlaybackInfoResponse } from "@jellyfin/sdk/lib/generated-client";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api";

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
        const jellyfinInstance = await createJellyfinInstance();
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
        const jellyfinInstance = await createJellyfinInstance();
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
        const jellyfinInstance = await createJellyfinInstance();
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

export async function postPlaybackInfo(
    itemId: string,
): Promise<PlaybackInfoResponse> {
    const { serverUrl, user } = await getAuthData();
    const jellyfinInstance = createJellyfinInstance();
    const api = jellyfinInstance.createApi(serverUrl);
    api.accessToken = user.AccessToken;

    try {
        const mediaInfoApi = getMediaInfoApi(api);

        // Create device profile for web client
        const deviceProfile = {
            MaxStreamingBitrate: 120000000,
            MaxStaticBitrate: 100000000,
            MusicStreamingTranscodingBitrate: 384000,
            DirectPlayProfiles: [
                { Container: "webm", Type: "Video", VideoCodec: "vp8,vp9,av1", AudioCodec: "vorbis,opus" },
                { Container: "mp4,m4v", Type: "Video", VideoCodec: "h264,hevc,vp9,av1", AudioCodec: "aac,mp3,mp2,opus,flac,vorbis" },
                { Container: "mov", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3,mp2,opus,flac,vorbis" },
                { Container: "opus", Type: "Audio" },
                { Container: "webm", AudioCodec: "opus", Type: "Audio" },
                { Container: "ts", AudioCodec: "mp3", Type: "Audio" },
                { Container: "mp3", Type: "Audio" },
                { Container: "aac", Type: "Audio" },
                { Container: "m4a", AudioCodec: "aac", Type: "Audio" },
                { Container: "m4b", AudioCodec: "aac", Type: "Audio" },
                { Container: "flac", Type: "Audio" },
                { Container: "webma", Type: "Audio" },
                { Container: "webm", AudioCodec: "webma", Type: "Audio" },
                { Container: "wav", Type: "Audio" },
                { Container: "ogg", Type: "Audio" },
                { Container: "hls", Type: "Video", VideoCodec: "av1,hevc,h264,vp9", AudioCodec: "aac,mp2,opus,flac" },
                { Container: "hls", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3,mp2" }
            ],
            TranscodingProfiles: [
                { Container: "mp4", Type: "Audio", AudioCodec: "aac", Context: "Streaming", Protocol: "hls", MaxAudioChannels: "2", MinSegments: "1", BreakOnNonKeyFrames: true, EnableAudioVbrEncoding: true },
                { Container: "aac", Type: "Audio", AudioCodec: "aac", Context: "Streaming", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "mp3", Type: "Audio", AudioCodec: "mp3", Context: "Streaming", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "opus", Type: "Audio", AudioCodec: "opus", Context: "Streaming", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "wav", Type: "Audio", AudioCodec: "wav", Context: "Streaming", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "opus", Type: "Audio", AudioCodec: "opus", Context: "Static", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "mp3", Type: "Audio", AudioCodec: "mp3", Context: "Static", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "aac", Type: "Audio", AudioCodec: "aac", Context: "Static", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "wav", Type: "Audio", AudioCodec: "wav", Context: "Static", Protocol: "http", MaxAudioChannels: "2" },
                { Container: "mp4", Type: "Video", AudioCodec: "aac,mp2,opus,flac", VideoCodec: "av1,hevc,h264,vp9", Context: "Streaming", Protocol: "hls", MaxAudioChannels: "2", MinSegments: "1", BreakOnNonKeyFrames: true },
                { Container: "ts", Type: "Video", AudioCodec: "aac,mp3,mp2", VideoCodec: "h264", Context: "Streaming", Protocol: "hls", MaxAudioChannels: "2", MinSegments: "1", BreakOnNonKeyFrames: true }
            ],
            ContainerProfiles: [],
            CodecProfiles: [
                { Type: "VideoAudio", Codec: "aac", Conditions: [{ Condition: "Equals", Property: "IsSecondaryAudio", Value: "false", IsRequired: false }] },
                { Type: "VideoAudio", Conditions: [{ Condition: "Equals", Property: "IsSecondaryAudio", Value: "false", IsRequired: false }] },
                {
                    Type: "Video", Codec: "h264", Conditions: [
                        { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoProfile", Value: "high|main|baseline|constrained baseline|high 10", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR", IsRequired: false },
                        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
                        { Condition: "NotEquals", Property: "IsInterlaced", Value: "true", IsRequired: false }
                    ]
                },
                {
                    Type: "Video", Codec: "hevc", Conditions: [
                        { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoProfile", Value: "main|main 10", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR|HDR10|HLG", IsRequired: false },
                        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
                        { Condition: "NotEquals", Property: "IsInterlaced", Value: "true", IsRequired: false }
                    ]
                },
                {
                    Type: "Video", Codec: "vp9", Conditions: [
                        { Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR|HDR10|HLG", IsRequired: false }
                    ]
                },
                {
                    Type: "Video", Codec: "av1", Conditions: [
                        { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoProfile", Value: "main", IsRequired: false },
                        { Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR|HDR10|HLG", IsRequired: false },
                        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "19", IsRequired: false }
                    ]
                }
            ],
            SubtitleProfiles: [
                { Format: "vtt", Method: "External" },
                { Format: "ass", Method: "External" },
                { Format: "ssa", Method: "External" }
            ],
            ResponseProfiles: [
                { Type: "Video", Container: "m4v", MimeType: "video/mp4" }
            ]
        };

        const playbackInfoRequest = {
            itemId: itemId,
            userId: user.Id,
            startTimeTicks: 0,
            isPlayback: true,
            autoOpenLiveStream: true,
            maxStreamingBitrate: 1440987877,
            alwaysBurnInSubtitleWhenTranscoding: false,
            deviceProfile: deviceProfile
        } as MediaInfoApiGetPostedPlaybackInfoRequest;

        const response = await mediaInfoApi.getPostedPlaybackInfo(playbackInfoRequest);
        return response.data;
    } catch (error) {
        console.error("Failed to get playback info:", error);
        throw error;
    }
}