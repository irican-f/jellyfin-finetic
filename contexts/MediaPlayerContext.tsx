import { useAtom } from "jotai";
import {
  isPlayerVisibleAtom,
  currentMediaAtom,
  currentMediaWithSourceAtom,
  skipTimestampAtom,
  skipToTimestampAtom,
  currentTimestampAtom,
  playMediaAtom,
  syncPlayCommandAtom,
  clearSyncPlayCommandAtom,
  MediaToPlay,
  CurrentMediaWithSource,
} from "@/lib/atoms";

export function useMediaPlayer() {
  const [isPlayerVisible, setIsPlayerVisible] = useAtom(isPlayerVisibleAtom);
  const [currentMedia] = useAtom(currentMediaAtom);
  const [currentMediaWithSource, setCurrentMediaWithSource] = useAtom(
    currentMediaWithSourceAtom
  );
  const [skipTimestamp] = useAtom(skipTimestampAtom);
  const [currentTimestamp, setCurrentTimestamp] = useAtom(currentTimestampAtom);
  const [, playMedia] = useAtom(playMediaAtom);
  const [, skipToTimestamp] = useAtom(skipToTimestampAtom);
  const [syncPlayCommand] = useAtom(syncPlayCommandAtom);
  const [, clearSyncPlayCommand] = useAtom(clearSyncPlayCommandAtom);

  return {
    isPlayerVisible,
    setIsPlayerVisible,
    playMedia,
    currentMedia,
    currentMediaWithSource,
    setCurrentMediaWithSource,
    skipToTimestamp,
    skipTimestamp,
    currentTimestamp,
    setCurrentTimestamp,
    syncPlayCommand,
    clearSyncPlayCommand,
  };
}

// Export types for backward compatibility
export type { MediaToPlay, CurrentMediaWithSource };
