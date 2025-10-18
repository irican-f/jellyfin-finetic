"use server";

import { cookies } from "next/headers";
import { UserLibraryApi } from "@jellyfin/sdk/lib/generated-client/api/user-library-api";
import { getUserViewsApi } from "@jellyfin/sdk/lib/utils/api/user-views-api";
import { createJellyfinInstance } from "@/lib/utils";
import { getSystemApi } from "@jellyfin/sdk/lib/utils/api/system-api";
import { LogFile } from "@jellyfin/sdk/lib/generated-client/models";
import { getOptimalStreamingParams } from "@/lib/device-detection";
import { MediaSourceInfo } from "@/types/jellyfin";

// Helper function to get auth data from cookies
export async function getAuthData() {
  const cookieStore = await cookies();
  const authData = cookieStore.get("jellyfin-auth");

  if (!authData?.value) {
    throw new Error("Not authenticated");
  }

  const parsed = JSON.parse(authData.value);
  return { serverUrl: parsed.serverUrl, user: parsed.user };
}

export async function getImageUrl(
  itemId: string,
  imageType: string = "Primary",
  quality?: number,
  tag?: string,
  maxWidth?: number,
  maxHeight?: number
): Promise<string> {
  const { serverUrl } = await getAuthData();

  const params = new URLSearchParams();

  // Set defaults based on image type
  if (imageType.toLowerCase() === "backdrop") {
    // Keep backdrops at high quality for full-screen display
    params.set("maxWidth", (maxWidth ?? 1920).toString());
    params.set("maxHeight", (maxHeight ?? 1080).toString());
    params.set("quality", (quality ?? 95).toString());
  } else if (imageType.toLowerCase() === "logo") {
    // Keep logos at high quality for crisp display
    params.set("maxWidth", (maxWidth ?? 800).toString());
    params.set("maxHeight", (maxHeight ?? 400).toString());
    params.set("quality", (quality ?? 95).toString());
  } else {
    // Optimize other image types (Primary, Thumb, etc.) for faster loading
    params.set("maxWidth", (maxWidth ?? 400).toString());
    params.set("maxHeight", (maxHeight ?? 600).toString());
    params.set("quality", (quality ?? 80).toString());
  }

  if (tag) {
    params.set("tag", tag);
  }

  return `${serverUrl}/Items/${itemId}/Images/${imageType}?${params.toString()}`;
}

export async function getDownloadUrl(itemId: string): Promise<string> {
  const { serverUrl, user } = await getAuthData();

  return `${serverUrl}/Items/${itemId}/Download?api_key=${user.AccessToken}`;
}

async function getDirectPlayUrl(
  itemId: string,
  mediaSourceId: string
): Promise<string> {
  const { serverUrl, user } = await getAuthData();

  return `${serverUrl}/Videos/${itemId}/stream?api_key=${user.AccessToken}&MediaSourceId=${mediaSourceId}&Static=true`;
}

async function getHlsUrl(
  itemId: string,
  mediaSource: MediaSourceInfo,
  streamingParams: ReturnType<typeof getOptimalStreamingParams>,
  audioStreamIndex: number
): Promise<string> {
  const { serverUrl, user } = await getAuthData();
  const {
    videoCodec,
    audioCodec,
    videoBitrate,
    audioBitrate,
    audioSampleRate,
    maxVideoBitrate,
    transcodingMaxAudioChannels,
    requireAvc,
    enableAudioVbrEncoding,
    hevcLevel,
    hevcVideoBitDepth,
    hevcProfile,
    hevcAudioChannels,
    aacProfile,
    av1Profile,
    av1RangeType,
    av1Level,
    vp9RangeType,
    hevcRangeType,
    hevcDeinterlace,
    h264Profile,
    h264RangeType,
    h264Level,
    h264Deinterlace,
    segmentContainer,
    minSegments,
  } = streamingParams;

  const videoStream = mediaSource.MediaStreams?.find(
    (stream) => stream.Type === "Video"
  );

  // Generate a unique PlaySessionId for each stream request
  const playSessionId = crypto.randomUUID();

  const params = new URLSearchParams({
    api_key: user.AccessToken,
    MediaSourceId: mediaSource.Id!,
    VideoCodec: videoCodec,
    AudioCodec: audioCodec,
    AudioStreamIndex: audioStreamIndex.toString(),
    VideoBitrate: videoBitrate.toString(),
    AudioBitrate: audioBitrate.toString(),
    AudioSampleRate: audioSampleRate.toString(),
    MaxFramerate: videoStream?.AverageFrameRate?.toString() ?? "23.976",
    PlaySessionId: playSessionId,
    TranscodingMaxAudioChannels: transcodingMaxAudioChannels.toString(),
    RequireAvc: requireAvc.toString(),
    EnableAudioVbrEncoding: enableAudioVbrEncoding.toString(),
    SegmentContainer: segmentContainer,
    MinSegments: minSegments.toString(),
    BreakOnNonKeyFrames: "True",
    "hevc-level": hevcLevel.toString(),
    "hevc-videobitdepth": hevcVideoBitDepth.toString(),
    "hevc-profile": hevcProfile,
    "hevc-audiochannels": hevcAudioChannels.toString(),
    "aac-profile": aacProfile,
    "av1-profile": av1Profile,
    "av1-rangetype": av1RangeType,
    "av1-level": av1Level.toString(),
    "vp9-rangetype": vp9RangeType,
    "hevc-rangetype": hevcRangeType,
    "hevc-deinterlace": hevcDeinterlace.toString(),
    "h264-profile": h264Profile,
    "h264-rangetype": h264RangeType,
    "h264-level": h264Level.toString(),
    "h264-deinterlace": h264Deinterlace.toString(),
  });

  return `${serverUrl}/Videos/${itemId}/master.m3u8?${params.toString()}`;
}

export async function getPlaybackUrl(
  itemId: string,
  mediaSource: MediaSourceInfo,
  directPlay: boolean,
  streamingParams: ReturnType<typeof getOptimalStreamingParams>,
  audioStreamIndex: number
): Promise<string> {
  if (directPlay) {
    // Audio track selection during direct play is handled by the client-side player, not the URL.
    return getDirectPlayUrl(itemId, mediaSource.Id!);
  } else {
    return getHlsUrl(itemId, mediaSource, streamingParams, audioStreamIndex);
  }
}

export async function getSubtitleTracks(
  itemId: string,
  mediaSourceId: string
): Promise<
  Array<{
    kind: string;
    label: string;
    language: string;
    src: string;
    default?: boolean;
  }>
> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    // First get the media item to find subtitle streams
    const userLibraryApi = new UserLibraryApi(api.configuration);
    const { data: item } = await userLibraryApi.getItem({
      userId: user.Id,
      itemId: itemId,
    });

    const mediaSource = item.MediaSources?.find(
      (ms) => ms.Id === mediaSourceId
    );
    const subtitleStreams =
      mediaSource?.MediaStreams?.filter(
        (stream) => stream.Type === "Subtitle"
      ) || [];
    const subtitleTracks = subtitleStreams.map((stream) => {
      const src = `${serverUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${stream.Index}/Stream.js?api_key=${user.AccessToken}`;
      return {
        kind: "subtitles",
        label:
          stream.DisplayTitle || stream.Language || `Track ${stream.Index}`,
        language: stream.Language || "unknown",
        src: src,
        default: stream.IsDefault || false,
      };
    });

    console.log("Subtitle tracks:", subtitleTracks);

    return subtitleTracks;
  } catch (error) {
    console.error("Failed to fetch subtitle tracks:", error);
    return [];
  }
}

export async function getUserLibraries(): Promise<any[]> {
  try {
    const { serverUrl, user } = await getAuthData();
    const jellyfinInstance = createJellyfinInstance();
    const api = jellyfinInstance.createApi(serverUrl);
    api.accessToken = user.AccessToken;

    const { data } = await getUserViewsApi(api).getUserViews({
      userId: user.Id,
      includeExternalContent: false,
    });

    // Filter for movie and TV show libraries only
    const supportedLibraries = (data.Items || []).filter((library: any) => {
      const type = library.CollectionType?.toLowerCase();
      return type === "movies" || type === "tvshows";
    });

    return supportedLibraries;
  } catch (error) {
    console.error("Failed to fetch user libraries:", error);
    return [];
  }
}

export async function getLibraryById(libraryId: string): Promise<any | null> {
  try {
    const { serverUrl, user } = await getAuthData();
    const jellyfinInstance = createJellyfinInstance();
    const api = jellyfinInstance.createApi(serverUrl);
    api.accessToken = user.AccessToken;

    const { data } = await getUserViewsApi(api).getUserViews({
      userId: user.Id,
      includeExternalContent: false,
    });

    const library = (data.Items || []).find((lib: any) => lib.Id === libraryId);
    return library || null;
  } catch (error) {
    console.error("Failed to fetch library by ID:", error);
    return null;
  }
}

export interface RemoteImage {
  ProviderName: string;
  CommunityRating: number;
  Height: number;
  Width: number;
  Language: string;
  RatingType: string;
  Type: string;
  Url: string;
  VoteCount: number;
}

export interface RemoteImagesResponse {
  Images: RemoteImage[];
}

export async function fetchRemoteImages(
  itemId: string,
  type: "Primary" | "Backdrop" | "Logo" | "Thumb" = "Primary",
  startIndex: number = 0,
  limit: number = 30,
  includeAllLanguages: boolean = false
): Promise<RemoteImagesResponse> {
  const { serverUrl, user } = await getAuthData();

  const params = new URLSearchParams({
    type,
    startIndex: startIndex.toString(),
    limit: limit.toString(),
    IncludeAllLanguages: includeAllLanguages.toString(),
  });

  const url = `${serverUrl}/Items/${itemId}/RemoteImages?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `MediaBrowser Token="${user.AccessToken}"`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch remote images: ${response.statusText}`);
  }

  return response.json();
}

export async function downloadRemoteImage(
  itemId: string,
  imageType: "Primary" | "Backdrop" | "Logo" | "Thumb",
  imageUrl: string,
  providerName: string
): Promise<void> {
  const { serverUrl, user } = await getAuthData();

  const params = new URLSearchParams({
    Type: imageType,
    ImageUrl: imageUrl,
    ProviderName: providerName,
  });

  const url = `${serverUrl}/Items/${itemId}/RemoteImages/Download?${params.toString()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `MediaBrowser Token="${user.AccessToken}"`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download remote image: ${response.statusText}`);
  }
}

export interface CurrentImage {
  ImageType: string;
  ImageIndex?: number;
  ImageTag: string;
  Path: string;
  BlurHash: string;
  Height: number;
  Width: number;
  Size: number;
}

export async function fetchCurrentImages(
  itemId: string
): Promise<CurrentImage[]> {
  const { serverUrl, user } = await getAuthData();

  const url = `${serverUrl}/Items/${itemId}/Images`;

  const response = await fetch(url, {
    headers: {
      Authorization: `MediaBrowser Token="${user.AccessToken}"`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current images: ${response.statusText}`);
  }

  return response.json();
}

export async function reorderBackdropImage(
  itemId: string,
  currentIndex: number,
  newIndex: number
): Promise<void> {
  const { serverUrl, user } = await getAuthData();
  console.log(
    `Reordering backdrop image for item ${itemId} from index ${currentIndex} to ${newIndex}`
  );

  const url = `${serverUrl}/Items/${itemId}/Images/Backdrop/${currentIndex}/Index?newIndex=${newIndex}`;
  console.log(`Reorder URL: ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `MediaBrowser Token="${user.AccessToken}"`,
    },
  });

  console.log(`Reorder response status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Failed to reorder backdrop image: ${response.statusText}`);
  }
}

export async function deleteImage(
  itemId: string,
  imageType: string,
  imageIndex?: number
): Promise<void> {
  const { serverUrl, user } = await getAuthData();

  let url = `${serverUrl}/Items/${itemId}/Images/${imageType}`;
  if (imageIndex !== undefined) {
    url += `/${imageIndex}`;
  }

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `MediaBrowser Token="${user.AccessToken}"`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to delete ${imageType} image: ${response.statusText}`
    );
  }
}

export interface UserPolicy {
  IsAdministrator: boolean;
  EnableMediaConversion: boolean;
  EnableContentDeletion: boolean;
}

export interface UserWithPolicy {
  Name: string;
  ServerId: string;
  Id: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin: boolean;
  LastLoginDate: string;
  LastActivityDate: string;
  Configuration: any;
  Policy: UserPolicy;
}

export async function getUserWithPolicy(
  userId: string,
  itemId: string
): Promise<UserWithPolicy | null> {
  const { serverUrl, user } = await getAuthData();

  const url = `${serverUrl}/Users/${userId}/Items/${itemId}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `MediaBrowser Token="${user.AccessToken}"`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch user policy: ${response.statusText}`);
      return null;
    }

    // The API endpoint you provided actually returns item data with user context
    // Let's get the current user data instead, which includes the policy
    const userUrl = `${serverUrl}/Users/${userId}`;
    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: `MediaBrowser Token="${user.AccessToken}"`,
      },
    });

    if (!userResponse.ok) {
      console.error(`Failed to fetch user data: ${userResponse.statusText}`);
      return null;
    }

    return userResponse.json();
  } catch (error) {
    console.error("Failed to fetch user with policy:", error);
    return null;
  }
}

export async function fetchScheduledTasks(): Promise<any[]> {
  const { serverUrl, user } = await getAuthData();

  const url = `${serverUrl}/ScheduledTasks`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `MediaBrowser Token="${user.AccessToken}"`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch scheduled tasks: ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching scheduled tasks:", error);
    return [];
  }
}

// Types for Jellyfin logs
export interface JellyfinLog {
  DateCreated: string;
  DateModified: string;
  Size: number;
  Name: string;
}

export async function fetchJellyfinLogs(): Promise<LogFile[]> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const systemApi = getSystemApi(api);
    const { data } = await systemApi.getServerLogs();

    return data || [];
  } catch (error) {
    console.error("Failed to fetch Jellyfin logs:", error);
    return [];
  }
}

export async function fetchLogContent(logName: string): Promise<string> {
  const { serverUrl, user } = await getAuthData();
  const jellyfinInstance = createJellyfinInstance();
  const api = jellyfinInstance.createApi(serverUrl);
  api.accessToken = user.AccessToken;

  try {
    const systemApi = getSystemApi(api);
    const response = await systemApi.getLogFile({
      name: logName,
    });

    return response.data as unknown as string;
  } catch (error) {
    console.error("Failed to fetch log content:", error);
    throw new Error("Could not fetch log content");
  }
}
