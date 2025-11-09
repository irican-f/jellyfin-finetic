/**
 * Message handlers for SyncPlay WebSocket messages
 * Handles different message types and updates state accordingly
 */

import { MediaToPlay } from '@/lib/atoms';
import { SyncPlayGroupUpdateMessage, SyncPlayCommandMessage, SyncPlayPlaylistItem, SyncPlayGroup } from '@/types/syncplay';
import { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client';
import { fetchMediaDetails } from '@/app/actions';
import { toast } from 'sonner';
import { CommandHandler } from './command-handler';
import { WebSocketManager } from './websocket-manager';

export interface MessageHandlerCallbacks {
    onCurrentGroupChanged: (group: SyncPlayGroup | null) => void;
    setAvailableGroups: (groups: GroupInfoDto[]) => void;
    setCurrentPlaylist: (playlist: SyncPlayPlaylistItem[]) => void;
    onCurrentPlaylistItemIdChanged: (id: string | null) => void;
    onPlayingChanged: (playing: boolean) => void;
    setIsProcessingSyncPlayUpdate: (processing: boolean) => void;
    playMedia: (media: MediaToPlay) => void;
    getSyncPlayGroups: () => Promise<GroupInfoDto[]>;
    disconnect: () => void;
    setIsEnabled: (enabled: boolean) => void;

    onRequestUnpause: () => Promise<void>;
    onRequestReady: (isReady: boolean, positionTicks: number) => Promise<void>;
    isPlayerReady: () => boolean;
    waitForPlayerReady: () => Promise<void>;
}

export interface MessageHandlerState {
    getCurrentGroup: () => SyncPlayGroup | null;
    availableGroups: GroupInfoDto[];
    getCurrentPlayingItemId: () => string | null;
    isPlaying: boolean;
    lastReadyPositionRef: React.MutableRefObject<number | null>;
}

export class MessageHandlers {
    private wsManager: WebSocketManager | null = null;

    constructor(
        private callbacks: MessageHandlerCallbacks,
        private state: MessageHandlerState,
        private commandHandler: CommandHandler
    ) { }

    setWebSocketManager(wsManager: WebSocketManager): void {
        this.wsManager = wsManager;
    }

    async handleMessage(message: any): Promise<void> {
        // Handle message ID deduplication with array (max 10 IDs)
        const messageId = message.MessageId;
        if (messageId) {
            if (!(window as any).messageIdsReceived) {
                (window as any).messageIdsReceived = [];
            }
            const messageIds = (window as any).messageIdsReceived as string[];

            if (messageIds.includes(messageId)) {
                console.log('🔄 Duplicate message ignored:', messageId);
                return;
            }

            // Add new ID and keep only last 10
            messageIds.push(messageId);
            if (messageIds.length > 10) {
                messageIds.shift(); // Remove oldest
            }
        }

        // Route to appropriate handler
        if (message.MessageType === 'SyncPlayGroupUpdate') {
            this.handleGroupUpdate(message as SyncPlayGroupUpdateMessage);
        } else if (message.MessageType === 'SyncPlayCommand') {
            await this.handleCommand(message as SyncPlayCommandMessage);
        } else if (message.MessageType === 'KeepAlive') {
            console.debug('Received KeepAlive from server.');
        } else if (message.MessageType === 'ForceKeepAlive') {
            const timeout = message.Data;
            console.debug(`Received ForceKeepAlive from server. Timeout is ${timeout} seconds.`);

            if (!this.wsManager) {
                return
            }

            this.wsManager.send('KeepAlive');
            this.wsManager.scheduleKeepAlive(timeout);
        } else {
            console.log('Unhandled WebSocket message type:', message.MessageType);
        }
    }

    private async handleGroupUpdate(message: SyncPlayGroupUpdateMessage): Promise<void> {
        const updateType = message.Data.Type;
        const data = message.Data.Data;

        // console.log('🎯 Processing SyncPlayGroupUpdate:', message);

        switch (updateType) {
            case 'GroupJoined':
                await this.handleGroupJoined(data);
                break;
            case 'UserJoined':
                this.handleUserJoined(data);
                break;
            case 'UserLeft':
                this.handleUserLeft(data);
                break;
            case 'PlayQueue':
                await this.handlePlayQueue(data);
                break;
            case 'StateUpdate':
                await this.handleStateUpdate(message, data);
                break;
            case 'GroupDoesNotExist':
                this.handleGroupDoesNotExist();
                break;
            default:
                console.log('Unhandled SyncPlayGroupUpdate type:', updateType);
        }
    }

    private async handleGroupJoined(data: any): Promise<void> {
        console.log('✅ GroupJoined received');
        if (typeof data === 'object' && data !== null) {
            const groupData = data;
            const groupState = groupData.State;
            const extendedGroup: SyncPlayGroup = {
                GroupId: groupData.GroupId,
                GroupName: groupData.GroupName,
                State: groupState,
                Participants: groupData.Participants,
                PlayingItemId: groupData.PlayingItemId,
                PositionTicks: groupData.PositionTicks || 0,
                IsPaused: groupState === 'Paused' || groupState === 'Waiting'
            };
            console.log('Setting current group to:', extendedGroup);
            this.callbacks.onCurrentGroupChanged(extendedGroup);

            toast.success(`Joined "${groupData.GroupName}"`, {
                description: `Connected to SyncPlay group with ${groupData.Participants?.length || 0} participants`,
            });
        }
    }

    private handleUserJoined(data: any): void {
        console.log('👤 UserJoined received');
        console.log('User joined:', data);
        toast.success(`${data} joined the group`, {
            description: 'SyncPlay group updated',
        });
        this.callbacks.getSyncPlayGroups()
            .then(groups => this.callbacks.setAvailableGroups(groups))
            .catch(console.error);
    }

    private handleUserLeft(data: any): void {
        console.log('👋 UserLeft received');
        console.log('User left:', data);
        toast.info(`${data} left the group`, {
            description: 'SyncPlay group updated',
        });
        this.callbacks.getSyncPlayGroups()
            .then(groups => this.callbacks.setAvailableGroups(groups))
            .catch(console.error);
    }

    private async handlePlayQueue(playlistData: any): Promise<void> {
        const reason = playlistData.Reason;
        console.log('🎵 PlayQueue update reason:', reason);

        this.callbacks.setIsProcessingSyncPlayUpdate(true);

        const newPlaylistItemId = playlistData.Playlist?.[playlistData.PlayingItemIndex]?.PlaylistItemId || null;

        this.callbacks.setCurrentPlaylist(playlistData.Playlist || []);
        this.callbacks.onCurrentPlaylistItemIdChanged(newPlaylistItemId);
        this.callbacks.onPlayingChanged(playlistData.IsPlaying || false);

        if (playlistData.Playlist && playlistData.Playlist.length > 0) {
            const playingItem = playlistData.Playlist[playlistData.PlayingItemIndex];

            if (playingItem) {
                const mediaDetails = await fetchMediaDetails(playingItem.ItemId);

                const mediaToPlay = {
                    id: mediaDetails?.Id,
                    name: mediaDetails?.Name || 'SyncPlay Item',
                    type: mediaDetails?.Type,
                    resumePositionTicks: playlistData.StartPositionTicks || 0
                } as MediaToPlay;

                console.log('🎮 Media to play:', playlistData.Playlist?.[playlistData.PlayingItemIndex]?.PlaylistItemId);

                this.callbacks.onCurrentPlaylistItemIdChanged(newPlaylistItemId);

                if (reason === 'NewPlaylist') {
                    console.log('🆕 New playlist started');
                    this.callbacks.playMedia(mediaToPlay);
                    toast.info('New playlist started', {
                        description: 'SyncPlay group is now playing',
                    });
                } else if (reason === 'SetCurrentItem') {
                    const isAlreadyPlaying = this.state.getCurrentPlayingItemId() === newPlaylistItemId;

                    if (!isAlreadyPlaying) {
                        console.log('🔄 Current item changed');
                        this.callbacks.playMedia(mediaToPlay);
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
            this.callbacks.onCurrentPlaylistItemIdChanged(null);
        }
    }

    private async handleStateUpdate(message: SyncPlayGroupUpdateMessage, data: any): Promise<void> {
        console.log('🔄 StateUpdate received', data.State, data.Reason);

        if (typeof data !== 'object' && data === null) {
            console.log('⚠️ Invalid data received for StateUpdate');
            return;
        }

        const groupToUpdate = this.state.getCurrentGroup();

        if (!groupToUpdate) {
            console.warn('⚠️ StateUpdate received but no current group found. GroupId:', message.Data.GroupId);
            return;
        }

        const groupData = data;

        const previousState = groupToUpdate.State;
        const previousReason = groupToUpdate.StateReason;
        const newState = groupData.State;
        const reason = groupData.Reason;
        const positionTicks = groupData.PositionTicks;

        const updatedGroup: SyncPlayGroup = {
            ...groupToUpdate,
            State: newState,
            StateReason: reason,
            IsPaused: newState === 'Paused' || newState === 'Waiting',
            PositionTicks: positionTicks
        };

        console.log(`State transition: ${previousState} (${previousReason}) → ${newState} (${reason})`);

        this.callbacks.onCurrentGroupChanged(updatedGroup);

        // Update playing state based on group state
        if (newState === 'Playing') {
            this.callbacks.onPlayingChanged(true);
        } else if (newState === 'Paused' || newState === 'Waiting') {
            this.callbacks.onPlayingChanged(false);
        }

        // Handle Waiting state transition
        if (newState === 'Waiting') {

            if (reason === 'Ready') {
                await this.callbacks.onRequestUnpause()
                return
            }

            // if (reason === 'Seek') {
            //     console.log('▶️ Group entered Waiting state with Seek reason - waiting for all clients to be ready');
            // }

            if (reason === 'Buffer') {
                const readyPosition = positionTicks !== undefined && positionTicks >= 0
                    ? positionTicks
                    : (this.state.lastReadyPositionRef.current ?? 0);

                if (readyPosition >= 0) {
                    // Check if player is ready, if not wait for it
                    if (!this.callbacks.isPlayerReady()) {
                        // console.log('⏳ Player not ready yet - waiting for videoCanPlay event before sending ready');
                        await this.callbacks.waitForPlayerReady();
                    }

                    // console.log('🔄 Send ready state buffering has ended', this.callbacks.isPlayerReady());
                    await this.callbacks.onRequestReady(true, readyPosition);
                }
            }

            // Only handle transition TO Waiting, not when already in Waiting
            if (previousState !== 'Waiting') {
                if (reason === 'Unpause') {
                    // console.log('▶️ Group entered Waiting state with Unpause reason - sending unpause request');
                    await this.callbacks.onRequestUnpause()
                }

                // Don't send seek command here - the Seek command was already received via SyncPlayCommand
                // StateUpdate with Seek reason just indicates the group is waiting after a seek
                // if (reason === 'Seek') {
                //     console.log('▶️ Group entered Waiting state with Seek reason - waiting for all clients to be ready');
                // }

                // if (reason === 'Buffer') {
                //     console.log('▶️ Group entered Waiting state with Buffer reason - sending buffer command');
                // }

                const readyPosition = positionTicks !== undefined && positionTicks >= 0
                    ? positionTicks
                    : (this.state.lastReadyPositionRef.current ?? 0);

                if (!this.callbacks.isPlayerReady()) {
                    await this.callbacks.waitForPlayerReady();
                }

                await this.callbacks.onRequestReady(true, readyPosition);
            }
            else {
                // For other reasons, only send ready if position changed significantly
                const lastReadyPos = this.state.lastReadyPositionRef.current;
                const positionChanged = lastReadyPos === null || Math.abs(positionTicks - lastReadyPos) > 1000000; // 0.1 seconds

                if (positionChanged && lastReadyPos !== null) {
                    console.log('🔄 Position changed while in Waiting state - sending ready with new position');
                    await this.callbacks.onRequestReady(true, positionTicks);
                }
            }
        }

        // Handle transition from Waiting to Playing
        if (newState === 'Playing' && previousState === 'Waiting') {
            console.log('▶️ Group transitioned from Waiting to Playing');
            this.callbacks.onPlayingChanged(true);
        }
    }

    private handleGroupDoesNotExist(): void {
        console.log('❌ GroupDoesNotExist received');
        this.callbacks.onCurrentGroupChanged(null);
        this.callbacks.setIsEnabled(false);
        this.callbacks.disconnect();

        toast.error('Group no longer exists', {
            description: 'You have been disconnected from the SyncPlay group',
        });
    }

    private async handleCommand(message: SyncPlayCommandMessage): Promise<void> {
        const command = message.Data;

        // Check for duplicate command
        if (this.commandHandler.isDuplicate(command)) {
            const shouldSkip = await this.commandHandler.handleDuplicate(command, this.state.isPlaying);

            if (shouldSkip) {
                return;
            }
        }

        // Store command for duplicate detection
        this.commandHandler.storeLastCommand(command);

        // Schedule command execution based on When timestamp and time sync
        // Commands are now handled directly by command handler via player interface
        const commandType = command.Command.toLowerCase() as 'unpause' | 'pause' | 'seek' | 'stop';
        await this.commandHandler.scheduleCommand(command, commandType);
    }
}

