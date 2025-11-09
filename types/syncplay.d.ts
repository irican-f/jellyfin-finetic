// WebSocket message types based on official Jellyfin SyncPlay protocol

interface WebSocketMessage {
    MessageType: string;
    MessageId?: string;
    Data?: any;
}

// SyncPlay specific message types
interface SyncPlayGroupUpdateMessage {
    MessageId: string;
    MessageType: 'SyncPlayGroupUpdate';
    Data: {
        Data: string | {
            GroupId: string;
            GroupName: string;
            State: string;
            Participants: string[];
            LastUpdatedAt: string;
            PlayingItemId?: string;
            PositionTicks?: number;
        };
        GroupId: string;
        Type: 'GroupJoined' | 'UserJoined' | 'UserLeft' | 'PlayQueue' | 'StateUpdate' | 'GroupDoesNotExist';
    };
}

// SyncPlay queue interfaces
interface SyncPlayPlaylistItem {
    ItemId: string;
    PlaylistItemId: string;
}

interface SyncPlayPlaylistMessage {
    MessageId: string;
    MessageType: 'SyncPlayGroupUpdate';
    Data: {
        Data: {
            Reason: 'NewPlaylist';
            LastUpdate: string;
            Playlist: SyncPlayPlaylistItem[];
            PlayingItemIndex: number;
            StartPositionTicks: number;
            IsPlaying: boolean;
            ShuffleMode: string;
            RepeatMode: string;
        };
        GroupId: string;
        Type: 'PlayQueue';
    };
}

interface SyncPlayCommandMessage {
    MessageId: string;
    MessageType: 'SyncPlayCommand';
    Data: {
        GroupId: string;
        PlaylistItemId: string;
        When: string;
        PositionTicks: number;
        Command: 'Unpause' | 'Pause' | 'Seek' | 'Stop';
        EmittedAt: string;
    };
}

// Client-to-Server Messages
interface SendCommand {
    Type: 'Unpause' | 'Pause' | 'Stop' | 'Seek' | 'NextItem' | 'PrevItem';
    PositionTicks?: number;
    When?: string;
}

// SyncPlay state - custom interface for our needs
interface SyncPlayGroup {
    GroupId?: string;
    GroupName?: string;
    State?: string; // 'Idle' | 'Waiting' | 'Paused' | 'Playing'
    StateReason?: string;
    Participants?: string[];
    PlayingItemId?: string;
    PositionTicks?: number;
    IsPaused: boolean; // true when State is 'Paused' or 'Waiting'
    LastUpdatedAt?: string;
}

/**
 * Player interface for SyncPlay context to control the player
 */
interface SyncPlayPlayerInterface {
    // State queries
    getCurrentTime: () => number; // in seconds
    getPositionTicks: () => number; // in ticks
    isPaused: () => boolean;
    isReady: () => boolean; // video can play

    // Controls
    play: () => void;
    pause: () => void;
    seek: (timeInSeconds: number) => void;
    seekToTicks: (positionTicks: number) => void;

    // Event emitter methods
    on: (event: 'userPlay' | 'userPause' | 'userSeek' | 'videoCanPlay' | 'videoBuffering' | 'videoSeeked', handler: (...args: any[]) => void) => void;
    off: (event: 'userPlay' | 'userPause' | 'userSeek' | 'videoCanPlay' | 'videoBuffering' | 'videoSeeked', handler: (...args: any[]) => void) => void;
    once: (event: 'userPlay' | 'userPause' | 'userSeek' | 'videoCanPlay' | 'videoBuffering' | 'videoSeeked', handler?: (...args: any[]) => void) => Promise<void>;
}

export type {
    WebSocketMessage,
    SyncPlayGroupUpdateMessage,
    SyncPlayPlaylistMessage,
    SyncPlayPlaylistItem,
    SyncPlayCommandMessage,
    SendCommand,
    SyncPlayGroup,
    SyncPlayPlayerInterface
};