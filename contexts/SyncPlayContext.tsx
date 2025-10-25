"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import {
    currentSyncPlayGroupAtom,
    isSyncPlayEnabledAtom, MediaToPlay,
    syncPlayConnectionStatusAtom,
    SyncPlayGroup,
    dispatchSyncPlayCommandAtom
} from '@/lib/atoms';
import {
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
} from '@/app/actions/syncplay';
import {
    GroupInfoDto,
    InboundWebSocketMessage,
    OutboundWebSocketMessage
} from '@jellyfin/sdk/lib/generated-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { fetchMediaDetails } from "@/app/actions";
import { playMediaAtom } from '@/lib/atoms';

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

const RECONNECT_INTERVAL = 5000; // 5 seconds
const PING_INTERVAL = 30000; // 30 seconds

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
    currentPlaylistItemId: string | null;
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
    requestUnpause: () => void;
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
    sendReadyState: (isReady: boolean, positionTicks: number) => Promise<void>;
}

const SyncPlayContext = createContext<SyncPlayContextType | null>(null);

export function SyncPlayProvider({ children }: { children: React.ReactNode }) {
    const { serverUrl, user, getDeviceId } = useAuth();
    const [, playMedia] = useAtom(playMediaAtom);
    const [currentGroup, setCurrentGroup] = useAtom(currentSyncPlayGroupAtom);
    const [isEnabled, setIsEnabled] = useAtom(isSyncPlayEnabledAtom);
    const [connectionStatus, setConnectionStatus] = useAtom(syncPlayConnectionStatusAtom);
    const [, dispatchSyncPlayCommand] = useAtom(dispatchSyncPlayCommandAtom);

    const [availableGroups, setAvailableGroups] = useState<GroupInfoDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isProcessingSyncPlayUpdate, setIsProcessingSyncPlayUpdate] = useState(false);
    const [lastSyncPlayCommand, setLastSyncPlayCommand] = useState<{
        when: string;
        positionTicks: number;
        command: string;
        playlistItemId: string;
    } | null>(null);

    // Queue state
    const [currentPlaylist, setCurrentPlaylist] = useState<SyncPlayPlaylistItem[]>([]);
    const [currentPlaylistItemId, setCurrentPlaylistItemId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const playstateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isConnectingRef = useRef<boolean>(false);
    const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const currentPlayingItemRef = useRef<string | null>(null);

    // WebSocket message sending functions - matching Jellyfin API client pattern
    const sendWebSocketMessage = useCallback((messageType: string, data?: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log(`Sending web socket message: ${messageType}`);
            const message: WebSocketMessage = {
                MessageType: messageType,
                Data: data
            };
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    // KeepAlive handling - matching Jellyfin API client pattern
    const scheduleKeepAlive = useCallback((timeout: number) => {
        clearKeepAlive();
        keepAliveIntervalRef.current = setInterval(() => {
            sendWebSocketMessage('KeepAlive');
        }, timeout * 1000 * 0.5);
        return keepAliveIntervalRef.current;
    }, [sendWebSocketMessage]);

    const clearKeepAlive = useCallback(() => {
        console.debug('Clearing KeepAlive for', wsRef.current);
        if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
        }
    }, []);

    // WebSocket connection management - matching Jellyfin API client pattern
    const connect = useCallback(() => {
        if (!serverUrl || !user || wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
            return;
        }

        isConnectingRef.current = true;
        setConnectionStatus('connecting');

        try {
            // Get device ID from useAuth hook
            const deviceId = getDeviceId();

            // Construct WebSocket URL exactly like Jellyfin web client
            let wsUrl = serverUrl;
            // Replace the protocol
            wsUrl = wsUrl.replace('https:', 'wss:');
            wsUrl = wsUrl.replace('http:', 'ws:');
            // Add the embywebsocket endpoint (same as Jellyfin web client)
            wsUrl = wsUrl.replace(/\/$/, '') + '/socket';
            wsUrl += `?api_key=${user.AccessToken}`;
            wsUrl += `&deviceId=${deviceId}`;
            console.log('Creating WebSocket connection...', wsUrl);
            const ws = new WebSocket(wsUrl);

            // Set up event handlers exactly like Jellyfin client
            ws.onopen = () => {
                console.log('web socket connection opened');
                isConnectingRef.current = false;
                setConnectionStatus('connected');
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('web socket closed');
                isConnectingRef.current = false;
                setConnectionStatus('disconnected');

                // Clear intervals
                if (playstateUpdateIntervalRef.current) {
                    clearInterval(playstateUpdateIntervalRef.current);
                    playstateUpdateIntervalRef.current = null;
                }

                // Null out WebSocket reference
                if (wsRef.current === ws) {
                    console.log('nulling out web socket');
                    wsRef.current = null;
                }
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket connection error:', error);
                console.error('WebSocket URL was:', wsUrl);
                console.error('Error details:', {
                    type: error.type,
                    target: error.target,
                    readyState: ws.readyState
                });
                isConnectingRef.current = false;
                setConnectionStatus('disconnected');
                setError('WebSocket connection failed');
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            isConnectingRef.current = false;
            setError('Failed to connect to SyncPlay');
            setConnectionStatus('disconnected');
        }
    }, [serverUrl, user, getDeviceId]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (playstateUpdateIntervalRef.current) {
            clearInterval(playstateUpdateIntervalRef.current);
            playstateUpdateIntervalRef.current = null;
        }

        clearKeepAlive();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }
        wsRef.current = null;
        isConnectingRef.current = false;

        setConnectionStatus('disconnected');
    }, [clearKeepAlive]);


    // Check if command is duplicate and handle state correction
    const isDuplicateCommand = useCallback((command: any): boolean => {
        if (!lastSyncPlayCommand) return false;

        return (
            lastSyncPlayCommand.when === command.When &&
            lastSyncPlayCommand.positionTicks === command.PositionTicks &&
            lastSyncPlayCommand.command === command.Command &&
            lastSyncPlayCommand.playlistItemId === command.PlaylistItemId
        );
    }, [lastSyncPlayCommand]);

    // Handle duplicate command by checking current state and correcting if needed
    const handleDuplicateCommand = useCallback(async (command: any) => {
        console.log('🔄 Duplicate SyncPlay command detected, checking state...', command);

        const currentTime = new Date();
        const commandTime = new Date(command.When);

        if (commandTime > currentTime) {
            console.log('⏰ Command is scheduled for future, ignoring duplicate');
            return true; // Command already scheduled
        }

        // Check if we need to correct the state based on the command
        // For now, we'll re-apply the command to ensure state consistency
        // In a more sophisticated implementation, we would check the actual media player state
        console.log('🔄 Re-applying duplicate command for state correction');

        // Apply the command directly to ensure state consistency
        switch (command.Command) {
            case 'Unpause':
                if (!isPlaying) {
                    console.log('🔄 Correcting state: should be playing');
                    setIsPlaying(true);
                    dispatchSyncPlayCommand({
                        type: 'unpause',
                        positionTicks: command.PositionTicks
                    });
                }
                break;
            case 'Pause':
                if (isPlaying) {
                    console.log('🔄 Correcting state: should be paused');
                    setIsPlaying(false);
                    dispatchSyncPlayCommand({
                        type: 'pause',
                        positionTicks: command.PositionTicks
                    });
                }
                break;
            case 'Stop':
                if (isPlaying) {
                    console.log('🔄 Correcting state: should be stopped');
                    setIsPlaying(false);
                    dispatchSyncPlayCommand({ type: 'stop' });
                }
                break;
            case 'Seek':
                console.log('🔄 Correcting state: seeking to position');
                dispatchSyncPlayCommand({
                    type: 'seek',
                    positionTicks: command.PositionTicks
                });
                break;
        }

        return true; // Skip normal processing since we handled it here
    }, [isPlaying, setIsPlaying, dispatchSyncPlayCommand]);

    // WebSocket message handlers - matching Jellyfin API client pattern
    const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {
        console.log('📨 Received WebSocket message:', JSON.stringify(message));

        // Handle message ID deduplication like Jellyfin client
        const messageId = message.MessageId;
        if (messageId) {
            // Check if message was already received (Jellyfin pattern)
            if ((window as any).messageIdsReceived?.[messageId]) {
                console.log('🔄 Duplicate message ignored:', messageId);
                return;
            }
            (window as any).messageIdsReceived = (window as any).messageIdsReceived || {};
            (window as any).messageIdsReceived[messageId] = true;
        }

        // Handle different message types exactly like Jellyfin client
        if (message.MessageType === 'UserDeleted') {
            // Handle user deletion
            console.log('UserDeleted received');
        } else if (message.MessageType === 'UserUpdated' || message.MessageType === 'UserConfigurationUpdated') {
            // Handle user updates
            console.log('User update received:', message.MessageType);
        } else if (message.MessageType === 'KeepAlive') {
            console.debug('Received KeepAlive from server.');
        } else if (message.MessageType === 'ForceKeepAlive') {
            console.debug(`Received ForceKeepAlive from server. Timeout is ${message.Data} seconds.`);
            sendWebSocketMessage('KeepAlive');
            scheduleKeepAlive(message.Data);
        } else if (message.MessageType === 'SyncPlayGroupUpdate') {
            // Handle SyncPlay group updates with proper data structure
            console.log('🎯 Processing SyncPlayGroupUpdate:', message);
            const groupUpdate = message as SyncPlayGroupUpdateMessage;
            const updateType = groupUpdate.Data.Type;
            const data = groupUpdate.Data.Data;

            switch (updateType) {
                case 'GroupJoined':
                    console.log('✅ GroupJoined received');
                    // For GroupJoined, data is the full group object
                    if (typeof data === 'object' && data !== null) {
                        const groupData = data as any;
                        const extendedGroup: SyncPlayGroup = {
                            GroupId: groupData.GroupId,
                            GroupName: groupData.GroupName,
                            State: groupData.State,
                            Participants: groupData.Participants,
                            PlayingItemId: groupData.PlayingItemId,
                            PositionTicks: groupData.PositionTicks || 0,
                            IsPaused: groupData.State === 'Paused'
                        };
                        console.log('Setting current group to:', extendedGroup);
                        setCurrentGroup(extendedGroup);

                        // Show toast notification for successful group join
                        toast.success(`Joined "${groupData.GroupName}"`, {
                            description: `Connected to SyncPlay group with ${groupData.Participants?.length || 0} participants`,
                        });
                    }
                    break;

                case 'UserJoined':
                    console.log('👤 UserJoined received');
                    console.log('User joined:', data); // data is the username string
                    // Show toast notification
                    toast.success(`${data} joined the group`, {
                        description: 'SyncPlay group updated',
                    });
                    // Refresh group list
                    getSyncPlayGroups().then(groups => setAvailableGroups(groups)).catch(console.error);
                    break;

                case 'UserLeft':
                    console.log('👋 UserLeft received');
                    console.log('User left:', data); // data is the username string
                    // Show toast notification
                    toast.info(`${data} left the group`, {
                        description: 'SyncPlay group updated',
                    });
                    // Refresh group list
                    getSyncPlayGroups().then(groups => setAvailableGroups(groups)).catch(console.error);
                    break;

                case 'PlayQueue':
                    if (typeof data === 'object' && data !== null) {
                        const playlistData = data as any;
                        const reason = playlistData.Reason;

                        console.log('🎵 PlayQueue update reason:', reason);

                        // Set flag to prevent command loops
                        setIsProcessingSyncPlayUpdate(true);

                        // Get the new playlist item ID before updating state
                        const newPlaylistItemId = playlistData.Playlist?.[playlistData.PlayingItemIndex]?.PlaylistItemId || null;

                        // Update playlist state
                        setCurrentPlaylist(playlistData.Playlist || []);
                        setCurrentPlaylistItemId(newPlaylistItemId);
                        setIsPlaying(playlistData.IsPlaying || false);

                        // Handle based on reason
                        if (playlistData.Playlist && playlistData.Playlist.length > 0) {
                            const playingItem = playlistData.Playlist[playlistData.PlayingItemIndex];

                            if (playingItem) {
                                if (reason === 'NewPlaylist') {
                                    // New playlist - always start playing
                                    console.log('🆕 New playlist started');

                                    const mediaDetails = await fetchMediaDetails(playingItem.ItemId)

                                    // Create media object for the player
                                    const mediaToPlay = {
                                        id: mediaDetails?.Id,
                                        name: mediaDetails?.Name || 'SyncPlay Item',
                                        type: mediaDetails?.Type,
                                        resumePositionTicks: playlistData.StartPositionTicks || 0
                                    } as MediaToPlay;

                                    console.log('🎮 Media to play:', playlistData.Playlist?.[playlistData.PlayingItemIndex]?.PlaylistItemId);

                                    // Update ref immediately to prevent duplicate processing
                                    currentPlayingItemRef.current = newPlaylistItemId;

                                    playMedia(mediaToPlay);

                                    // Show toast notification
                                    toast.info('New playlist started', {
                                        description: 'SyncPlay group is now playing',
                                    });
                                } else if (reason === 'SetCurrentItem') {
                                    // Current item changed - check if it's different
                                    const isAlreadyPlaying = currentPlayingItemRef.current === newPlaylistItemId;

                                    if (!isAlreadyPlaying) {
                                        console.log('🔄 Current item changed');

                                        const mediaDetails = await fetchMediaDetails(playingItem.ItemId)

                                        // Create media object for the player
                                        const mediaToPlay = {
                                            id: mediaDetails?.Id,
                                            name: mediaDetails?.Name || 'SyncPlay Item',
                                            type: mediaDetails?.Type,
                                            resumePositionTicks: playlistData.StartPositionTicks || 0
                                        } as MediaToPlay;

                                        console.log('🎮 Media to play:', playlistData.Playlist?.[playlistData.PlayingItemIndex]?.PlaylistItemId);

                                        // Update ref immediately to prevent duplicate processing
                                        currentPlayingItemRef.current = newPlaylistItemId;

                                        playMedia(mediaToPlay);

                                        // Show toast notification
                                        toast.info('Item changed', {
                                            description: 'SyncPlay group switched to new item',
                                        });
                                    } else {
                                        console.log('🎵 Item already playing, skipping media player restart');
                                    }
                                } else {
                                    console.log('⚠️ Unknown PlayQueue reason:', reason);
                                }
                            } else {
                                console.log('⚠️ No playing item found in playlist');
                            }
                        } else {
                            console.log('⚠️ No playlist or empty playlist received');
                            currentPlayingItemRef.current = null;
                        }
                    }
                    break;

                case 'StateUpdate':
                    console.log('🔄 StateUpdate received');
                    if (typeof data === 'object' && data !== null && currentGroup) {
                        const groupData = data as any;
                        const newGroup: SyncPlayGroup = {
                            ...currentGroup,
                            IsPaused: groupData.State === 'Paused',
                            PositionTicks: groupData.PositionTicks || 0
                        };
                        setCurrentGroup(newGroup);
                    }
                    break;

                case 'GroupDoesNotExist':
                    console.log('❌ GroupDoesNotExist received');
                    setCurrentGroup(null);
                    setIsEnabled(false);
                    disconnect();

                    // Show toast notification for group not found
                    toast.error('Group no longer exists', {
                        description: 'You have been disconnected from the SyncPlay group',
                    });
                    break;

                default:
                    console.log('Unhandled SyncPlayGroupUpdate type:', updateType);
            }
        } else if (message.MessageType === 'SyncPlayCommand') {
            // Handle SyncPlay commands
            console.log('🎮 Processing SyncPlayCommand:', message);
            const command = message as SyncPlayCommandMessage;
            console.log('Command:', command.Data.Command);
            console.log('Position:', command.Data.PositionTicks);
            console.log('When:', command.Data.When);

            // Check for duplicate command
            if (isDuplicateCommand(command.Data)) {
                const shouldSkip = await handleDuplicateCommand(command.Data);
                if (shouldSkip) {
                    console.log('⏭️ Skipping duplicate command');
                    return;
                }
            }

            // Store command for duplicate detection
            setLastSyncPlayCommand({
                when: command.Data.When,
                positionTicks: command.Data.PositionTicks,
                command: command.Data.Command,
                playlistItemId: command.Data.PlaylistItemId
            });

            // Apply the command to local player
            switch (command.Data.Command) {
                case 'Unpause':
                    console.log('▶️ SyncPlay Unpause command received');
                    console.log('Position:', command.Data.PositionTicks);
                    setIsPlaying(true);
                    dispatchSyncPlayCommand({
                        type: 'unpause',
                        positionTicks: command.Data.PositionTicks
                    });
                    break;

                case 'Pause':
                    console.log('⏸️ SyncPlay Pause command received');
                    console.log('Position:', command.Data.PositionTicks);
                    setIsPlaying(false);
                    dispatchSyncPlayCommand({
                        type: 'pause',
                        positionTicks: command.Data.PositionTicks
                    });
                    break;

                case 'Seek':
                    console.log('⏩ SyncPlay Seek command received');
                    dispatchSyncPlayCommand({
                        type: 'seek',
                        positionTicks: command.Data.PositionTicks
                    });
                    break;

                case 'Stop':
                    console.log('⏹️ SyncPlay Stop command received');
                    setIsPlaying(false);
                    dispatchSyncPlayCommand({ type: 'stop' });
                    break;

                default:
                    console.log('Unknown SyncPlay command:', command.Data.Command);
            }
        } else {
            console.log('Unhandled WebSocket message type:', message.MessageType);
        }
    }, [setCurrentGroup, currentGroup, setIsEnabled, disconnect, sendWebSocketMessage, getSyncPlayGroups, setAvailableGroups]);

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
            setCurrentGroup({
                GroupId: group.GroupId,
                GroupName: group.GroupName,
                State: group.State as any,
                Participants: group.Participants as any, // Type assertion for compatibility
                PlayingItemId: (group as any).PlayingItemId,
                PositionTicks: (group as any).PositionTicks,
                IsPaused: (group as any).IsPaused || false
            });
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
            // Find the group in available groups and set it as current
            const group = availableGroups.find(g => g.GroupId === groupId);
            if (group) {
                setCurrentGroup({
                    GroupId: group.GroupId,
                    GroupName: group.GroupName,
                    State: group.State as any,
                    Participants: group.Participants as any, // Type assertion for compatibility
                    PlayingItemId: (group as any).PlayingItemId,
                    PositionTicks: (group as any).PositionTicks,
                    IsPaused: (group as any).IsPaused || false
                });
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
            currentPlayingItemRef.current = null;
            console.log('Leaving group - disconnecting WebSocket');
            disconnect();
        } catch (error) {
            console.error('Failed to leave SyncPlay group:', error);
            setError('Failed to leave group');
            // Still disconnect on error
            setCurrentGroup(null);
            setIsEnabled(false);
            disconnect();
        } finally {
            setIsLoading(false);
        }
    }, [setCurrentGroup, setIsEnabled, disconnect]);

    // Send SyncPlay command via WebSocket
    const sendSyncPlayCommand = useCallback((command: SendCommand, skipLog = false) => {
        // if (wsRef.current?.readyState === WebSocket.OPEN) {
        //     const message = {
        //         MessageId: crypto.randomUUID().replace(/-/g, ''),
        //         MessageType: 'SyncPlayCommand',
        //         Data: {
        //             GroupId: currentGroup?.GroupId || '',
        //             PlaylistItemId: currentPlaylistItemId || '00000000000000000000000000000000',
        //             When: command.When || new Date().toISOString(),
        //             PositionTicks: command.PositionTicks || 0,
        //             Command: command.Type,
        //             EmittedAt: new Date().toISOString()
        //         }
        //     };
        //     if (!skipLog) {
        //         console.log('Sending SyncPlay command:', command.Type, 'for playlist item:', currentPlaylistItemId);
        //     }
        //     wsRef.current.send(JSON.stringify(message));
        // } else {
        //     console.error('WebSocket not connected, cannot send command');
        //     setError('Not connected to SyncPlay group');
        // }
    }, [currentGroup, currentPlaylistItemId]);

    // Playback control functions - now using WebSocket commands
    const requestPause = useCallback(() => {
        if (!isProcessingSyncPlayUpdate) {
            sendSyncPlayCommand({ Type: 'Pause' });
        }
    }, [sendSyncPlayCommand, isProcessingSyncPlayUpdate]);

    const requestUnpause = useCallback(() => {
        if (!isProcessingSyncPlayUpdate) {
            sendSyncPlayCommand({ Type: 'Unpause' });
        }
    }, [sendSyncPlayCommand, isProcessingSyncPlayUpdate]);

    const requestStop = useCallback(() => {
        sendSyncPlayCommand({ Type: 'Stop' });
    }, [sendSyncPlayCommand]);

    const requestSeek = useCallback((positionTicks: number) => {
        if (!isProcessingSyncPlayUpdate) {
            sendSyncPlayCommand({
                Type: 'Seek',
                PositionTicks: positionTicks,
                When: new Date().toISOString()
            });
        }
    }, [sendSyncPlayCommand, isProcessingSyncPlayUpdate]);

    // SyncPlay buffering and ready state functions
    const requestBuffering = useCallback(async (isBuffering: boolean, positionTicks: number) => {
        try {
            await syncPlayBuffering(isBuffering, positionTicks);
            console.log('🔄 SyncPlay buffering state sent:', { isBuffering, positionTicks });
        } catch (error) {
            console.error('Failed to send buffering state:', error);
        }
    }, []);

    const requestReady = useCallback(async (isReady: boolean, positionTicks: number) => {
        try {
            await syncPlayReady(isReady, positionTicks);
            console.log('✅ SyncPlay ready state sent:', { isReady, positionTicks });
        } catch (error) {
            console.error('Failed to send ready state:', error);
        }
    }, []);

    const queueItems = useCallback(async (itemIds: string[], mode: string = "QueueNext") => {
        try {
            await syncPlayQueue(itemIds, mode);
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

    // WebSocket functions - now using proper SyncPlay commands
    const sendPlaystateUpdate = useCallback((positionTicks: number, isPaused: boolean) => {
        // Send appropriate command based on state
        if (isPaused) {
            sendSyncPlayCommand({ Type: 'Pause' });
        } else {
            sendSyncPlayCommand({ Type: 'Unpause' });
        }
    }, [sendSyncPlayCommand]);

    const sendProgressUpdate = useCallback((itemId: string, positionTicks: number) => {
        // Send seek command to update position
        sendSyncPlayCommand({
            Type: 'Seek',
            PositionTicks: positionTicks,
            When: new Date().toISOString()
        });
    }, [sendSyncPlayCommand]);

    const syncManually = useCallback(() => {
        if (currentGroup && currentGroup.PositionTicks !== undefined) {
            sendPlaystateUpdate(currentGroup.PositionTicks, currentGroup.IsPaused);
        }
    }, [currentGroup, sendPlaystateUpdate]);

    const refreshGroups = useCallback(async () => {
        await listGroups();
    }, [listGroups]);

    // SyncPlay ready state function
    const sendReadyState = useCallback(async (isReady: boolean, positionTicks: number) => {
        try {
            await syncPlayReady(isReady, positionTicks);
            console.log('✅ SyncPlay ready state sent:', { isReady, positionTicks });
        } catch (error) {
            console.error('Failed to send SyncPlay ready state:', error);
        }
    }, []);

    // Manual connection control - no auto-connect
    // Connection is only established when explicitly joining/creating a group

    // Cleanup on unmount
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
        currentPlaylistItemId,
        isPlaying,

        // Socket management,
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
        sendReadyState,
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
