"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import {
    dispatchSyncPlayCommandAtom,
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
} from '@/app/actions/syncplay';
import { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client';
import { useAuth } from '@/hooks/useAuth';
import { SyncPlayGroup, SyncPlayPlaylistItem } from '@/types/syncplay';
import { WebSocketManager } from '@/lib/syncplay/websocket-manager';
import { CommandHandler } from '@/lib/syncplay/command-handler';
import { MessageHandlers } from '@/lib/syncplay/message-handlers';
import { groupInfoToSyncPlayGroup } from '@/lib/syncplay/state-manager';

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

    // Playback control
    requestPause: () => void;
    requestUnpause: () => Promise<void>;
    requestStop: () => void;
    requestSeek: (positionTicks: number) => void;
    requestBuffering: (isBuffering: boolean, positionTicks: number) => Promise<void>;
    requestReady: (isReady: boolean, positionTicks: number) => Promise<void>;
    queueItems: (itemIds: string[], mode?: string) => Promise<void>;
    setNewQueue: (itemIds: string[], startPosition?: number) => Promise<void>;

    // WebSocket functions
    sendPlaystateUpdate: (positionTicks: number, isPaused: boolean) => void;
    sendProgressUpdate: (itemId: string, positionTicks: number) => void;
    syncManually: () => void;
}

const SyncPlayContext = createContext<SyncPlayContextType | null>(null);

export function SyncPlayProvider({ children }: { children: React.ReactNode }) {
    const { serverUrl, user, getDeviceId } = useAuth();
    const [, playMedia] = useAtom(playMediaAtom);
    const [currentGroup, setCurrentGroup] = useAtom(syncPlayGroupAtom);
    const [isEnabled, setIsEnabled] = useAtom(isSyncPlayEnabledAtom);
    const [connectionStatus, setConnectionStatus] = useAtom(syncPlayConnectionStatusAtom);
    const [, dispatchSyncPlayCommand] = useAtom(dispatchSyncPlayCommandAtom);

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

    // Initialize managers
    const wsManagerRef = useRef<WebSocketManager | null>(null);
    const commandHandlerRef = useRef<CommandHandler | null>(null);
    const messageHandlersRef = useRef<MessageHandlers | null>(null);

    // Keep ref in sync with atom value
    useEffect(() => {
        currentGroupRef.current = currentGroup;
    }, [currentGroup]);


    // Initialize WebSocket manager
    useEffect(() => {
        if (!serverUrl || !user || !user.AccessToken) return;

        const commandHandler = new CommandHandler({
            setIsPlaying,
            dispatchCommand: (type, positionTicks) => {
                dispatchSyncPlayCommand({
                    type,
                    positionTicks
                });
            }
        });
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
                onSyncPlayCommand: (type, positionTicks) => {
                    dispatchSyncPlayCommand({
                        type,
                        positionTicks
                    });
                },
                onRequestReady: requestReady,
                getSyncPlayGroups,
                disconnect,
                setIsEnabled,

                onRequestUnpause: requestUnpause
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
            if (wsManagerRef.current) {
                wsManagerRef.current.disconnect();
            }
        };
    }, [serverUrl, user]);

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
            disconnect();
        } catch (error) {
            console.error('Failed to leave SyncPlay group:', error);
            setError('Failed to leave group');
            setCurrentGroup(null);
            setIsEnabled(false);
            disconnect();
        } finally {
            setIsLoading(false);
        }
    }, [setCurrentGroup, setIsEnabled, disconnect]);

    // Playback control functions
    const requestPause = useCallback(() => {
        if (!isProcessingSyncPlayUpdate) {
            // Commands are sent via server actions, not WebSocket
            // This is a placeholder for future implementation
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

    const requestSeek = useCallback((positionTicks: number) => {
        if (!isProcessingSyncPlayUpdate) {
            // Commands are sent via server actions, not WebSocket
            // This is a placeholder for future implementation
        }
    }, [isProcessingSyncPlayUpdate]);

    const requestBuffering = useCallback(async (isBuffering: boolean, positionTicks: number) => {
        try {
            await syncPlayBuffering(isBuffering, positionTicks, currentPlayingItemIdRef.current);
            console.log('🔄 SyncPlay buffering state sent:', { isBuffering, positionTicks });
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
            console.log('✅ SyncPlay ready state sent:', { isReady, positionTicks });
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

    // WebSocket functions
    const sendPlaystateUpdate = useCallback((positionTicks: number, isPaused: boolean) => {
        // Commands are sent via server actions, not WebSocket
        // This is a placeholder for future implementation
    }, []);

    const sendProgressUpdate = useCallback((itemId: string, positionTicks: number) => {
        // Commands are sent via server actions, not WebSocket
        // This is a placeholder for future implementation
    }, []);

    const syncManually = useCallback(() => {
        if (currentGroup && currentGroup.PositionTicks !== undefined) {
            sendPlaystateUpdate(currentGroup.PositionTicks, currentGroup.IsPaused);
        }
    }, [currentGroup, sendPlaystateUpdate]);

    const refreshGroups = useCallback(async () => {
        await listGroups();
    }, [listGroups]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

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

        // Playback control
        requestPause,
        requestUnpause,
        requestStop,
        requestSeek,
        requestBuffering,
        requestReady,
        queueItems,
        setNewQueue,

        // WebSocket functions
        sendPlaystateUpdate,
        sendProgressUpdate,
        syncManually,
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
