import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { MediaSourceInfo } from "@/types/jellyfin";

// AI Ask state
export const isAIAskOpenAtom = atom(false);

// Search display mode (persisted in localStorage)
export type SearchDisplayMode = "grid" | "list";
export const searchDisplayModeAtom = atomWithStorage<SearchDisplayMode>(
  "search-display-mode",
  "list"
);

// Navigator enabled state (will be synced with settings)
export const isNavigatorEnabledAtom = atom(false);

// Fullscreen state
export const isFullscreenAtom = atom(false);

// Electron state
export const isElectronMacAtom = atom(false);
export const isElectronFullscreenAtom = atom((get) => {
  const isElectronMac = get(isElectronMacAtom);
  const isFullscreen = get(isFullscreenAtom);
  return isElectronMac && isFullscreen;
});

// Media Player state
export interface MediaToPlay {
  id: string;
  name: string;
  type: "Movie" | "Series" | "Episode";
  resumePositionTicks?: number;
  selectedVersion?: MediaSourceInfo;
}

export interface CurrentMediaWithSource {
  id: string;
  name: string;
  type: "Movie" | "Series" | "Episode";
  mediaSourceId?: string | null;
}

export const isPlayerVisibleAtom = atom(false);
export const currentMediaAtom = atom<MediaToPlay | null>(null);
export const currentMediaWithSourceAtom = atom<CurrentMediaWithSource | null>(
  null
);
export const skipTimestampAtom = atom<number | null>(null);
export const currentTimestampAtom = atom(0);

// Derived atom for playing media
export const playMediaAtom = atom(null, (get, set, media: MediaToPlay) => {
  set(currentMediaAtom, media);
  set(isPlayerVisibleAtom, true);
});

// Derived atom for skipping to timestamp
export const skipToTimestampAtom = atom(null, (get, set, timestamp: number) => {
  set(skipTimestampAtom, timestamp);
  // Clear the timestamp after a short delay to allow the player to consume it
  setTimeout(() => set(skipTimestampAtom, null), 100);
});

// Aurora background colors with transition support
export const auroraColorsAtom = atom<string[]>([
  "#AA5CC3",
  "#00A4DC",
  "#AA5CC3",
]);

export const previousAuroraColorsAtom = atom<string[]>([
  "#AA5CC3",
  "#00A4DC",
  "#AA5CC3",
]);

// Derived atom for updating colors with transition
export const updateAuroraColorsAtom = atom(
  null,
  (get, set, newColors: string[]) => {
    const currentColors = get(auroraColorsAtom);
    set(previousAuroraColorsAtom, currentColors);
    set(auroraColorsAtom, newColors);
  }
);
