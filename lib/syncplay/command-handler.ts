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
    dispatchCommand: (type: 'unpause' | 'pause' | 'seek' | 'stop', positionTicks?: number) => void;
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

    scheduleCommand(
        command: SyncPlayCommand,
        commandType: 'unpause' | 'pause' | 'seek' | 'stop'
    ): void {
        // Create a unique key for this command to prevent duplicate execution
        const commandKey = `${command.When}-${command.Command}-${command.PositionTicks}`;

        // Check if this exact command was already executed
        if (this.executedCommands.has(commandKey)) {
            return;
        }

        const serverTime = new Date(command.When);
        const timeSync = this.getTimeSync?.();
        const currentTime = new Date();

        let commandTime: Date;
        if (timeSync) {
            commandTime = timeSync.remoteDateToLocal(serverTime);
            const delay = commandTime.getTime() - currentTime.getTime();

            // If the delay is suspiciously large (>5 seconds), something is wrong with time sync
            // In this case, execute immediately since we can't trust the client's clock
            if (Math.abs(delay) > 5000) {
                console.warn(`⚠️ Suspicious delay detected (${delay.toFixed(2)}ms). Client clock appears to be wrong. Executing command immediately.`);
                // Execute immediately - don't schedule
                this.executedCommands.add(commandKey);
                this.callbacks.dispatchCommand(commandType, command.PositionTicks);
                return;
            }
        } else {
            commandTime = serverTime; // Fallback if time sync not available
            console.log(`⚠️ No time sync available, using server time directly`);
        }

        const delay = commandTime.getTime() - currentTime.getTime();

        // If delay is still suspiciously large even after time sync, execute immediately
        if (Math.abs(delay) > 5000) {
            console.warn(`⚠️ Large delay after time sync (${delay.toFixed(2)}ms). Executing command immediately.`);
            this.executedCommands.add(commandKey);
            this.callbacks.dispatchCommand(commandType, command.PositionTicks);
            return;
        }

        // Clear any existing timeout for this command
        const existingTimeout = this.scheduledTimeouts.get(commandKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        if (delay > 0) {
            // Schedule for future execution
            console.log(`⏰ Scheduling command ${commandType} to execute in ${delay}ms (at ${commandTime.toISOString()})`);
            const timeout = setTimeout(() => {
                // Mark as executed before executing to prevent race conditions
                this.executedCommands.add(commandKey);
                this.callbacks.dispatchCommand(commandType, command.PositionTicks);
                this.scheduledTimeouts.delete(commandKey);
            }, delay);
            this.scheduledTimeouts.set(commandKey, timeout);
        } else {
            // Execute immediately if time has already passed
            // console.log(`✅ Executing command ${commandType} immediately (scheduled time ${commandTime.toISOString()} has passed)`);
            // Mark as executed before executing
            this.executedCommands.add(commandKey);
            this.callbacks.dispatchCommand(commandType, command.PositionTicks);
        }
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