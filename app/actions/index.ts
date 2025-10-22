// Auth actions
export {
  setServerUrl,
  getServerUrl,
  checkServerHealth,
  authenticateUser,
  logout,
  getUser,
  isAuthenticated,
} from './auth';

// Media actions
export {
  fetchMovies,
  fetchTVShows,
  fetchMediaDetails,
  fetchPersonDetails,
  fetchPersonFilmography,
  fetchResumeItems,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
  fetchLibraryItems,
  fetchSimilarItems,
  scanLibrary,
} from './media';

// TV show actions
export {
  fetchSeasons,
  fetchEpisodes,
  fetchTVShowDetails,
  fetchEpisodeDetails,
  fetchEpisodesForCurrentSeason,
} from './tv-shows';

// Episode navigation actions
export {
  getNextEpisode,
  getPreviousEpisode,
} from './episode-navigation';

// Search actions
export {
  searchItems,
  searchPeople,
} from './search';

// Utility actions
export {
  getImageUrl,
  getDownloadUrl,
  getPlaybackUrl,
  getSubtitleTracks,
  getUserLibraries,
  getLibraryById,
  fetchRemoteImages,
  downloadRemoteImage,
  fetchCurrentImages,
  reorderBackdropImage,
  deleteImage,
  getUserWithPolicy,
} from './utils';

// SyncPlay actions
export {
  getSyncPlayGroups,
  createSyncPlayGroup,
  joinSyncPlayGroup,
  leaveSyncPlayGroup,
  syncPlayPause,
  syncPlayUnpause,
  syncPlayStop,
  syncPlaySeek,
  syncPlayBuffering,
  syncPlayReady,
  syncPlayQueue,
  syncPlaySetNewQueue,
} from './syncplay';

// Types
export type {
  RemoteImage,
  RemoteImagesResponse,
  CurrentImage,
  UserPolicy,
  UserWithPolicy,
} from './utils';

export type {
  BufferRequestDto,
  ReadyRequestDto,
  SeekRequestDto,
  NewGroupRequestDto,
  JoinGroupRequestDto,
} from './syncplay';
