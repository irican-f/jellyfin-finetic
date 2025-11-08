/**
 * Command handler for SyncPlay
 * Handles duplicate detection and state correction
 */

export interface SyncPlayCommand {
    When: string;
    PositionTicks: number;
    Command: 'Unpause' | 'Pause' | 'Seek' | 'Stop';
    PlaylistItemId: string;
}

export interface LastCommand {
    when: string;
    positionTicks: number;
    command: string;
    playlistItemId: string;
}

export interface PendingCommand {
    command: 'Unpause' | 'Pause' | 'Seek' | 'Stop';
    positionTicks: number;
    when: string;
}

export interface CommandHandlerCallbacks {
    setIsPlaying: (playing: boolean) => void;
    dispatchCommand: (type: 'unpause' | 'pause' | 'seek' | 'stop', positionTicks?: number) => void;
}

export class CommandHandler {
    private lastCommand: LastCommand | null = null;
    private pendingCommand: PendingCommand | null = null;
    private lastProcessedDuplicate: LastCommand | null = null; // Track last duplicate we processed

    constructor(private callbacks: CommandHandlerCallbacks) { }

    isDuplicate(command: SyncPlayCommand): boolean {
        if (!this.lastCommand) return false;

        return (
            this.lastCommand.when === command.When &&
            this.lastCommand.positionTicks === command.PositionTicks &&
            this.lastCommand.command === command.Command &&
            this.lastCommand.playlistItemId === command.PlaylistItemId
        );
    }

    async handleDuplicate(command: SyncPlayCommand, isPlaying: boolean): Promise<boolean> {
        console.log('🔄 Duplicate SyncPlay command detected, checking state...', command);

        const currentTime = new Date();
        const commandTime = new Date(command.When);

        if (commandTime > currentTime) {
            console.log('⏰ Command is scheduled for future, ignoring duplicate');
            return true; // Command already scheduled
        }

        // Check if we've already processed this exact duplicate command
        const commandKey: LastCommand = {
            when: command.When,
            positionTicks: command.PositionTicks,
            command: command.Command,
            playlistItemId: command.PlaylistItemId
        };

        if (this.lastProcessedDuplicate &&
            this.lastProcessedDuplicate.when === commandKey.when &&
            this.lastProcessedDuplicate.positionTicks === commandKey.positionTicks &&
            this.lastProcessedDuplicate.command === commandKey.command &&
            this.lastProcessedDuplicate.playlistItemId === commandKey.playlistItemId) {
            console.log('⏭️ Already processed this duplicate command, skipping to prevent loop');
            return true; // Already processed, skip to prevent infinite loop
        }

        console.log('🔄 Re-applying duplicate command for state correction');

        // Apply the command directly to ensure state consistency
        switch (command.Command) {
            case 'Unpause':
                if (!isPlaying) {
                    console.log('🔄 Correcting state: should be playing');
                    this.callbacks.setIsPlaying(true);
                    this.callbacks.dispatchCommand('unpause', command.PositionTicks);
                    this.lastProcessedDuplicate = commandKey; // Mark as processed
                } else {
                    // Already in correct state, just mark as processed
                    this.lastProcessedDuplicate = commandKey;
                }
                break;
            case 'Pause':
                if (isPlaying) {
                    console.log('🔄 Correcting state: should be paused');
                    this.callbacks.setIsPlaying(false);
                    this.callbacks.dispatchCommand('pause', command.PositionTicks);
                    this.lastProcessedDuplicate = commandKey; // Mark as processed
                } else {
                    // Already in correct state, just mark as processed
                    this.lastProcessedDuplicate = commandKey;
                }
                break;
            case 'Stop':
                if (isPlaying) {
                    console.log('🔄 Correcting state: should be stopped');
                    this.callbacks.setIsPlaying(false);
                    this.callbacks.dispatchCommand('stop');
                    this.lastProcessedDuplicate = commandKey; // Mark as processed
                } else {
                    // Already in correct state, just mark as processed
                    this.lastProcessedDuplicate = commandKey;
                }
                break;
            case 'Seek':
                console.log('🔄 Correcting state: seeking to position');
                this.callbacks.dispatchCommand('seek', command.PositionTicks);
                this.lastProcessedDuplicate = commandKey; // Mark as processed
                break;
        }

        return true; // Skip normal processing since we handled it here
    }

    storeLastCommand(command: SyncPlayCommand): void {
        this.lastCommand = {
            when: command.When,
            positionTicks: command.PositionTicks,
            command: command.Command,
            playlistItemId: command.PlaylistItemId
        };
    }

    setPendingCommand(command: PendingCommand): void {
        this.pendingCommand = command;
    }

    getPendingCommand(): PendingCommand | null {
        return this.pendingCommand;
    }

    clearPendingCommand(): void {
        this.pendingCommand = null;
    }
}

