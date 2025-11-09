/**
 * Command handler for SyncPlay
 * Handles duplicate detection and state correction
 */

import { TimeSync } from './time-sync';

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

export interface CommandHandlerCallbacks {
    setIsPlaying: (playing: boolean) => void;
    dispatchCommand: (type: 'unpause' | 'pause' | 'seek' | 'stop', positionTicks?: number) => Promise<void>;
    forceTimeSyncUpdate?: () => Promise<number>;
}

export class CommandHandler {
    private lastCommand: LastCommand | null = null;
    private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private executedCommands: Set<string> = new Set(); // Track executed commands to prevent re-execution

    constructor(
        private callbacks: CommandHandlerCallbacks,
        private getTimeSync?: () => TimeSync | null
    ) { }

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
        // console.log('🔄 Duplicate SyncPlay command detected, skipping...');

        const currentTime = new Date();
        // Convert server timestamp to local time using time sync
        const serverTime = new Date(command.When);
        const timeSync = this.getTimeSync?.();
        const commandTime = timeSync
            ? timeSync.remoteDateToLocal(serverTime)
            : serverTime; // Fallback if time sync not available

        if (commandTime > currentTime) {
            // console.log('⏰ Command is scheduled for future, ignoring duplicate');
            return true; // Command already scheduled
        }

        // Just skip duplicate commands - they've already been executed
        // State synchronization is handled by StateUpdate messages
        // console.log('⏭️ Skipping duplicate command - already executed');
        return true;
    }

    private async calculateCommandTime(serverTime: Date): Promise<Date> {
        const timeSync = this.getTimeSync?.();

        if (!timeSync || !timeSync.isReady()) {
            return serverTime;
        }

        // Update stale time sync if needed
        if (timeSync.isStale() && this.callbacks.forceTimeSyncUpdate) {
            await this.callbacks.forceTimeSyncUpdate();
        }

        return timeSync.remoteDateToLocal(serverTime);
    }

    private executeCommandImmediately(
        commandKey: string,
        commandType: 'unpause' | 'pause' | 'seek' | 'stop',
        positionTicks?: number
    ): void {
        this.executedCommands.add(commandKey);
        this.callbacks.dispatchCommand(commandType, positionTicks);
    }

    async scheduleCommand(
        command: SyncPlayCommand,
        commandType: 'unpause' | 'pause' | 'seek' | 'stop'
    ): Promise<void> {
        this.clearScheduledCommands();

        const commandKey = `${command.When}-${command.Command}-${command.PositionTicks}`;

        if (this.executedCommands.has(commandKey)) {
            return;
        }

        const maxAllowedDelay = 5000;
        const serverTime = new Date(command.When);
        const localTime = new Date();
        const commandTime = await this.calculateCommandTime(serverTime);
        let delay = commandTime.getTime() - localTime.getTime();

        // Execute immediately if delay is suspicious or negative
        if (delay < 0) {
            this.executeCommandImmediately(commandKey, commandType, command.PositionTicks);
            return;
        }

        if (delay > maxAllowedDelay) {
            console.warn(`⚠️ Delay too large (${delay.toFixed(2)}ms) for ${commandType}.`);
        }

        // Schedule for future execution
        console.log(`⏰ Scheduling ${commandType} in ${delay}ms`);
        const timeout = setTimeout(() => {
            this.executeCommandImmediately(commandKey, commandType, command.PositionTicks);
            this.scheduledTimeouts.delete(commandKey);
        }, delay);

        this.scheduledTimeouts.set(commandKey, timeout);
    }

    storeLastCommand(command: SyncPlayCommand): void {
        this.lastCommand = {
            when: command.When,
            positionTicks: command.PositionTicks,
            command: command.Command,
            playlistItemId: command.PlaylistItemId
        };
    }

    clearScheduledCommands(): void {
        this.scheduledTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.scheduledTimeouts.clear();
    }

    clearExecutedCommands(): void {
        this.executedCommands.clear();
    }
}