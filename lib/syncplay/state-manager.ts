/**
 * State management utilities for SyncPlay
 * Helper functions for managing group state and transformations
 */

import { SyncPlayGroup } from '@/types/syncplay';
import { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client';

/**
 * Convert a GroupInfoDto to SyncPlayGroup
 */
export function groupInfoToSyncPlayGroup(group: GroupInfoDto & { PlayingItemId?: string; PositionTicks?: number }): SyncPlayGroup {
    const groupState = group.State as string;
    return {
        GroupId: group.GroupId,
        GroupName: group.GroupName,
        State: groupState,
        Participants: group.Participants as any,
        PlayingItemId: group.PlayingItemId,
        PositionTicks: group.PositionTicks || 0,
        IsPaused: groupState === 'Paused' || groupState === 'Waiting'
    };
}

/**
 * Create a SyncPlayGroup from raw group data
 */
export function createSyncPlayGroupFromData(groupData: any): SyncPlayGroup {
    const groupState = groupData.State;
    return {
        GroupId: groupData.GroupId,
        GroupName: groupData.GroupName,
        State: groupState,
        Participants: groupData.Participants,
        PlayingItemId: groupData.PlayingItemId,
        PositionTicks: groupData.PositionTicks || 0,
        IsPaused: groupState === 'Paused' || groupState === 'Waiting'
    };
}

/**
 * Calculate position ticks from multiple sources
 * Priority: StateUpdate > PendingCommand > PreviousPosition
 */
export function calculatePositionTicks(
    stateUpdatePosition?: number,
    pendingCommandPosition?: number,
    previousPosition: number = 0
): number {
    if (stateUpdatePosition && stateUpdatePosition > 0) {
        return stateUpdatePosition;
    }
    if (pendingCommandPosition && pendingCommandPosition > 0) {
        return pendingCommandPosition;
    }
    return previousPosition;
}

