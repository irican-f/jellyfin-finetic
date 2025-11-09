/**
 * Time synchronization with server for SyncPlay
 * @module lib/syncplay/time-sync-server
 */

import { TimeSync, TimeSyncCallbacks } from './time-sync';
import { getUtcTime } from '@/app/actions/server';

/**
 * Class that manages time syncing with server
 */
export class TimeSyncServer extends TimeSync {
    /**
     * Makes a ping request to the server
     */
    async requestPing(): Promise<{
        requestSent: Date;
        requestReceived: Date;
        responseSent: Date;
        responseReceived: Date;
    }> {
        const requestSent = new Date();

        const data = await getUtcTime();

        const responseReceived = new Date();
        // getUtcTime already returns Date objects, but they may be serialized as strings
        // from server actions, so we ensure they're Date objects
        const requestReceived = data.requestReceived instanceof Date
            ? data.requestReceived
            : new Date(data.requestReceived);
        const responseSent = data.responseSent instanceof Date
            ? data.responseSent
            : new Date(data.responseSent);

        return {
            requestSent,
            requestReceived,
            responseSent,
            responseReceived
        };
    }
}

