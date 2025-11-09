"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import {
    isSyncPlayEnabledAtom,
    playMediaAtom,
    syncPlayConnectionStatusAtom,
    syncPlayGroupAtom
} from '@/lib/atoms';
import {
    createSyncPlayGroup,
    getSyncPlayGroups,
    joinSyncPlayGroup,
    leaveSyncPlayGroup,
    syncPlayBuffering,
    syncPlayQueue,
    syncPlayReady,
    syncPlaySetNewQueue,
    syncPlayUnpause,
    syncPlayStop,
    syncPlayPause,
    syncPlaySeek,
    syncPlayPing,
} from '@/app/actions/syncplay';
import { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client';
import { useAuth } from '@/hooks/useAuth';
import { SyncPlayGroup, SyncPlayPlaylistItem, SyncPlayPlayerInterface } from '@/types/syncplay';
import { WebSocketManager } from '@/lib/syncplay/websocket-manager';
import { CommandHandler } from '@/lib/syncplay/command-handler';
import { MessageHandlers } from '@/lib/syncplay/message-handlers';
import { groupInfoToSyncPlayGroup } from '@/lib/syncplay/state-manager';
import { TimeSyncServer } from '@/lib/syncplay/time-sync-server';

interface SyncPlayContextType {
    // State
    currentGroup: SyncPlayGroup | null;
    isEnabled: boolean;
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    availableGroups: GroupInfoDto[];
    isLoading: boolean;
    error: string | null;

    // Queue state
    currentPlaylist: SyncPlayPlaylistItem[];
    isPlaying: boolean;

    // Socket connection
    connect: () => void;
    disconnect: () => void;

    // Group management
    listGroups: () => Promise<void>;
    createGroup: (groupName: string) => Promise<void>;
    joinGroup: (groupId: string) => Promise<void>;
    leaveGroup: () => Promise<void>;
    refreshGroups: () => Promise<void>;

    // Player registration (player registers itself with SyncPlay context)
    registerPlayer: (player: SyncPlayPlayerInterface | null) => void;

    // Legacy playback control (kept for backward compatibility, but context now controls player directly)
    requestPause: () => void;
    requestUnpause: () => Promise<void>;
    requestStop: () => void;
    requestSeek: (positionTicks: number) => void;
    requestBuffering: (isBuffering: boolean, positionTicks: number) => Promise<void>;
    requestReady: (isReady: boolean, positionTicks: number) => Promise<void>;
    queueItems: (itemIds: string[], mode?: string) => Promise<void>;
    setNewQueue: (itemIds: string[], startPosition?: number) => Promise<void>;

}

const SyncPlayContext = createContext<SyncPlayContextType | null>(null);

export function SyncPlayProvider({ children }: { children: React.ReactNode }) {
    const { serverUrl, user, getDeviceId } = useAuth();
    const [, playMedia] = useAtom(playMediaAtom);
    const [currentGroup, setCurrentGroup] = useAtom(syncPlayGroupAtom);
    const [isEnabled, setIsEnabled] = useAtom(isSyncPlayEnabledAtom);
    const [connectionStatus, setConnectionStatus] = useAtom(syncPlayConnectionStatusAtom);

    const [availableGroups, setAvailableGroups] = useState<GroupInfoDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isProcessingSyncPlayUpdate, setIsProcessingSyncPlayUpdate] = useState(false);

    // Queue state
    const [currentPlaylist, setCurrentPlaylist] = useState<SyncPlayPlaylistItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);

    // Refs for state management
    const currentPlayingItemIdRef = useRef<string | null>(null);
    const lastReadyPositionRef = useRef<number | null>(null);
    const currentGroupRef = useRef<SyncPlayGroup | null>(null);
    const isEnabledRef = useRef<boolean>(false);

    // Player interface ref - player registers itself here
    const playerRef = useRef<SyncPlayPlayerInterface | null>(null);

    // Initialize managers
    const wsManagerRef = useRef<WebSocketManager | null>(null);
    const commandHandlerRef = useRef<CommandHandler | null>(null);
    const messageHandlersRef = useRef<MessageHandlers | null>(null);
    const timeSyncRef = useRef<TimeSyncServer | null>(null);

    // Keep refs in sync with atom values
    useEffect(() => {
        currentGroupRef.current = currentGroup;
    }, [currentGroup]);

    useEffect(() => {
        isEnabledRef.current = isEnabled;
    }, [isEnabled]);

    // Helper to check if player is ready (defined at component level)
    const isPlayerReady = useCallback(() => {
        return playerRef.current?.isReady() ?? false;
    }, []);

    // Helper to wait for player to be ready (defined at component level)
    const waitForPlayerReady = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            if (!playerRef.current) {
                console.warn('⚠️ No player registered, cannot wait for ready');
                resolve();
                return;
            }

            // Check if already ready
            if (playerRef.current.isReady()) {
                resolve();
                return;
            }

            // Wait for videoCanPlay event
            const timeout = setTimeout(() => {
                console.warn('⚠️ Timeout waiting for player to be ready');
                playerRef.current?.off('videoCanPlay', handler);
                resolve();
            }, 10000); // 10 second timeout

            const handler = () => {
                clearTimeout(timeout);
                playerRef.current?.off('videoCanPlay', handler);
                resolve();
            };

            playerRef.current.once('videoCanPlay', handler);
        });
    }, []);

    // Initialize time sync, WebSocket manager, and handlers
    useEffect(() => {
        if (!serverUrl || !user || !user.AccessToken) return;

        // Initialize time sync
        timeSyncRef.current = new TimeSyncServer({
            onUpdate: async (timeOffset, ping) => {
                // Report ping back to server when SyncPlay is enabled
                // Use ref to check current state to avoid stale closure
                if (isEnabledRef.current) {
                    try {
                        await syncPlayPing(ping);
                        console.log('⏱️ TimeSync update - offset:', timeOffset.toFixed(2), 'ms, ping:', ping.toFixed(2), 'ms');
                    } catch (error) {
                        console.error('Failed to send SyncPlay ping:', error);
                    }
                }
            }
        });

        // Create command handler with time sync getter
        // Command handler will use playerRef to control player directly
        const commandHandler = new CommandHandler({
            setIsPlaying,
            dispatchCommand: (type, positionTicks) => {
                // Control player directly via interface instead of dispatching through atoms
                const player = playerRef.current;
                if (!player) {
                    console.warn('⚠️ SyncPlay command received but player not registered');
                    return;
                }

                // Convert ticks to seconds (10,000,000 ticks = 1 second)
                const ticksToSeconds = (ticks: number) => ticks / 10_000_000;

                switch (type) {
                    case 'pause':
                        if (positionTicks !== undefined && positionTicks > 0) {
                            const timeInSeconds = ticksToSeconds(positionTicks);
                            const currentTime = player.getCurrentTime();
                            if (Math.abs(timeInSeconds - currentTime) > 0.5) {
                                player.seekToTicks(positionTicks);
                            }
                        }
                        player.pause();
                        break;
                    case 'unpause':
                        if (positionTicks !== undefined && positionTicks > 0) {
                            const timeInSeconds = ticksToSeconds(positionTicks);
                            const currentTime = player.getCurrentTime();
                            if (Math.abs(timeInSeconds - currentTime) > 0.5) {
                                player.seekToTicks(positionTicks);
                            }
                        }
                        player.play();
                        break;
                    case 'seek':
                        if (positionTicks !== undefined) {
                            player.seekToTicks(positionTicks);
                        }
                        break;
                    case 'stop':
                        player.pause();
                        player.seek(0);
                        break;
                }
            }
        }, () => timeSyncRef.current);
        commandHandlerRef.current = commandHandler;

        wsManagerRef.current = new WebSocketManager(
            serverUrl!,
            user.AccessToken!,
            getDeviceId(),
            {
                onOpen: () => {
                    setConnectionStatus('connected');
                    setError(null);
                },
                onMessage: (message) => {
                    if (messageHandlersRef.current) {
                        messageHandlersRef.current.handleMessage(message);
                    }
                },
                onClose: () => {
                    setConnectionStatus('disconnected');
                },
                onError: (error) => {
                    console.error('❌ WebSocket connection error:', error);
                    setConnectionStatus('disconnected');
                    setError('WebSocket connection failed');
                }
            }
        );

        messageHandlersRef.current = new MessageHandlers(
            {
                onCurrentGroupChanged: setCurrentGroup,
                setAvailableGroups,
                setCurrentPlaylist,
                onCurrentPlaylistItemIdChanged: (playlistItemId) => {
                    currentPlayingItemIdRef.current = playlistItemId
                },
                onPlayingChanged: setIsPlaying,
                setIsProcessingSyncPlayUpdate,
                playMedia,
                onRequestReady: requestReady,
                getSyncPlayGroups,
                disconnect,
                setIsEnabled,

                onRequestUnpause: requestUnpause,
                isPlayerReady,
                waitForPlayerReady
            },
            {
                getCurrentGroup: () => currentGroupRef.current,
                availableGroups,
                getCurrentPlayingItemId: () => currentPlayingItemIdRef.current,
                isPlaying,
                lastReadyPositionRef
            },
            commandHandler
        );

        // Set WebSocket manager reference so message handlers can schedule keep-alive
        messageHandlersRef.current.setWebSocketManager(wsManagerRef.current);

        return () => {
            if (timeSyncRef.current) {
                timeSyncRef.current.stopPing();
            }
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
            }
        };
    }, [serverUrl, user, isPlayerReady, waitForPlayerReady]);

    // WebSocket connection management
    const connect = useCallback(() => {
        if (wsManagerRef.current && !wsManagerRef.current.isConnected) {
            wsManagerRef.current.connect();
        }
    }, []);

    const disconnect = useCallback(() => {
        if (wsManagerRef.current) {
            wsManagerRef.current.disconnect();
        }
        setConnectionStatus('disconnected');
    }, [setConnectionStatus]);

    // Group management functions
    const listGroups = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const groups = await getSyncPlayGroups();
            setAvailableGroups(groups);
        } catch (error) {
            console.error('Failed to fetch SyncPlay groups:', error);
            setError('Failed to fetch groups');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createGroup = useCallback(async (groupName: string) => {
        try {
            setIsLoading(true);
            setError(null);
            const group = await createSyncPlayGroup(groupName);
            const syncPlayGroup = groupInfoToSyncPlayGroup(group);
            setCurrentGroup(syncPlayGroup);
            setIsEnabled(true);
            connect();
            // Start time sync when SyncPlay is enabled
            if (timeSyncRef.current) {
                timeSyncRef.current.forceUpdate();
            }
        } catch (error) {
            console.error('Failed to create SyncPlay group:', error);
            setError('Failed to create group');
        } finally {
            setIsLoading(false);
        }
    }, [setCurrentGroup, setIsEnabled, connect]);

    const joinGroup = useCallback(async (groupId: string) => {
        try {
            setIsLoading(true);
            setError(null);
            connect();
            await joinSyncPlayGroup(groupId);
            setIsEnabled(true);
            // Start time sync when SyncPlay is enabled
            if (timeSyncRef.current) {
                timeSyncRef.current.forceUpdate();
            }
        } catch (error) {
            console.error('Failed to join SyncPlay group:', error);
            setError('Failed to join group');
        } finally {
            setIsLoading(false);
        }
    }, [setIsEnabled, connect, availableGroups, setCurrentGroup]);

    const leaveGroup = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            await leaveSyncPlayGroup();
            setCurrentGroup(null);
            setIsEnabled(false);
            currentPlayingItemIdRef.current = null;
            // Stop time sync when SyncPlay is disabled
            if (timeSyncRef.current) {
                timeSyncRef.current.stopPing();
                timeSyncRef.current.resetMeasurements();
            }
            disconnect();
        } catch (error) {
            console.error('Failed to leave SyncPlay group:', error);
            setError('Failed to leave group');
            setCurrentGroup(null);
            setIsEnabled(false);
            // Stop time sync when SyncPlay is disabled
            if (timeSyncRef.current) {
                timeSyncRef.current.stopPing();
                timeSyncRef.current.resetMeasurements();
            }
            disconnect();
        } finally {
            setIsLoading(false);
        }
    }, [setCurrentGroup, setIsEnabled, disconnect]);

    // Playback control functions
    const requestPause = useCallback(async () => {
        if (!isProcessingSyncPlayUpdate) {
            try {
                await syncPlayPause();
                console.log('✅ SyncPlay pause request sent');
            } catch (error) {
                console.error('Failed to send pause request:', error);
            }
        }
    }, [isProcessingSyncPlayUpdate]);

    const requestUnpause = useCallback(async () => {
        if (!isProcessingSyncPlayUpdate) {
            try {
                await syncPlayUnpause();
                console.log('✅ SyncPlay unpause state sent');
            } catch (error) {
                console.error('Failed to send unpause state:', error);
            }
        }
    }, [isProcessingSyncPlayUpdate]);

    const requestStop = useCallback(async () => {
        try {
            await syncPlayStop();
            console.log('✅ SyncPlay unpause state sent');
        } catch (error) {
            console.error('Failed to send unpause state:', error);
        }
    }, []);

    const requestSeek = useCallback(async (positionTicks: number) => {
        if (!isProcessingSyncPlayUpdate) {
            try {
                await syncPlaySeek(positionTicks);
                console.log('✅ SyncPlay seek request sent:', positionTicks);
            } catch (error) {
                console.error('Failed to send seek request:', error);
            }
        }
    }, [isProcessingSyncPlayUpdate]);

    const requestBuffering = useCallback(async (isBuffering: boolean, positionTicks: number) => {
        try {
            await syncPlayBuffering(isBuffering, positionTicks, currentPlayingItemIdRef.current);
            console.trace('🔄 SyncPlay buffering state sent:', { isBuffering, positionTicks });
        } catch (error) {
            console.error('Failed to send buffering state:', error);
        }
    }, []);

    const requestReady = useCallback(async (isReady: boolean, positionTicks: number) => {
        try {
            if (isReady) {
                lastReadyPositionRef.current = positionTicks;
            } else {
                lastReadyPositionRef.current = null;
            }
            await syncPlayReady(isReady, positionTicks, currentPlayingItemIdRef.current);
        } catch (error) {
            console.error('Failed to send ready state:', error);
            if (isReady) {
                lastReadyPositionRef.current = null;
            }
        }
    }, []);

    const queueItems = useCallback(async (itemIds: string[], mode: string = "QueueNext") => {
        try {
            await syncPlayQueue(itemIds, mode as any);
        } catch (error) {
            console.error('Failed to queue items:', error);
            setError('Failed to queue items');
        }
    }, []);

    const setNewQueue = useCallback(async (itemIds: string[], startPosition: number = 0) => {
        try {
            await syncPlaySetNewQueue(itemIds, startPosition);
        } catch (error) {
            console.error('Failed to set new queue:', error);
            setError('Failed to set new queue');
        }
    }, []);


    const refreshGroups = useCallback(async () => {
        await listGroups();
    }, [listGroups]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Event handlers for player events (defined before registerPlayer to avoid closure issues)
    const handleUserPlay = useCallback(() => {
        if (!isEnabled || !currentGroup || isProcessingSyncPlayUpdate) return;
        // User initiated play - send unpause request to server
        requestUnpause();
    }, [isEnabled, currentGroup, isProcessingSyncPlayUpdate, requestUnpause]);

    const handleUserPause = useCallback(() => {
        if (!isEnabled || !currentGroup || isProcessingSyncPlayUpdate) return;
        // User initiated pause - send pause request to server
        requestPause();
    }, [isEnabled, currentGroup, isProcessingSyncPlayUpdate, requestPause]);

    const handleUserSeek = useCallback((timeInSeconds: number) => {
        if (!isEnabled || !currentGroup || isProcessingSyncPlayUpdate) return;
        // User initiated seek - send seek request to server
        const positionTicks = Math.floor(timeInSeconds * 10000000);
        requestSeek(positionTicks);
    }, [isEnabled, currentGroup, isProcessingSyncPlayUpdate, requestSeek]);

    const handleVideoCanPlay = useCallback(() => {
        if (!isEnabled || !currentGroup || !playerRef.current) return;
        // Video can play - send ready state to server
        const positionTicks = playerRef.current.getPositionTicks();

        requestReady(true, positionTicks);
    }, [isEnabled, currentGroup, requestReady]);

    const handleVideoBuffering = useCallback(() => {
        if (!isEnabled || !currentGroup || !playerRef.current) return;
        // Video is buffering - send buffering state to server
        const positionTicks = playerRef.current.getPositionTicks();
        requestBuffering(true, positionTicks);
    }, [isEnabled, currentGroup, requestBuffering]);

    const handleVideoSeeked = useCallback(() => {
        if (!isEnabled || !currentGroup || !playerRef.current) return;
        // Video seek completed - send ready state if needed
        const positionTicks = playerRef.current.getPositionTicks();
        requestReady(true, positionTicks);
    }, [isEnabled, currentGroup, requestReady]);

    // Register player interface and subscribe to events
    const registerPlayer = useCallback((player: SyncPlayPlayerInterface | null) => {
        // Unsubscribe from previous player if exists
        if (playerRef.current) {
            const previousPlayer = playerRef.current;
            previousPlayer.off('userPlay', handleUserPlay);
            previousPlayer.off('userPause', handleUserPause);
            previousPlayer.off('userSeek', handleUserSeek);
            previousPlayer.off('videoCanPlay', handleVideoCanPlay);
            previousPlayer.off('videoBuffering', handleVideoBuffering);
            previousPlayer.off('videoSeeked', handleVideoSeeked);
        }

        playerRef.current = player;

        // Subscribe to new player events
        if (player) {
            player.on('userPlay', handleUserPlay);
            player.on('userPause', handleUserPause);
            player.on('userSeek', handleUserSeek);
            player.on('videoCanPlay', handleVideoCanPlay);
            player.on('videoBuffering', handleVideoBuffering);
            player.on('videoSeeked', handleVideoSeeked);
        }
    }, [handleUserPlay, handleUserPause, handleUserSeek, handleVideoCanPlay, handleVideoBuffering, handleVideoSeeked]);

    const contextValue: SyncPlayContextType = {
        // State
        currentGroup,
        isEnabled,
        connectionStatus,
        availableGroups,
        isLoading,
        error,

        // Queue state
        currentPlaylist,
        isPlaying,

        // Socket management
        connect,
        disconnect,

        // Group management
        listGroups,
        createGroup,
        joinGroup,
        leaveGroup,
        refreshGroups,

        // Player registration
        registerPlayer,

        // Playback control
        requestPause,
        requestUnpause,
        requestStop,
        requestSeek,
        requestBuffering,
        requestReady,
        queueItems,
        setNewQueue,
    };

    return (
        <SyncPlayContext.Provider value={contextValue}>
            {children}
        </SyncPlayContext.Provider>
    );
}

export function useSyncPlay() {
    const context = useContext(SyncPlayContext);

    if (!context) {
        throw new Error('useSyncPlay must be used within a SyncPlayProvider');
    }

    return context;
}
