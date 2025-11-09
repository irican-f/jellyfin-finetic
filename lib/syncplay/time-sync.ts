/**
 * Time synchronization for SyncPlay
 * Based on Jellyfin's TimeSync implementation
 * @module lib/syncplay/time-sync
 */

const NumberOfTrackedMeasurements = 8;
const PollingIntervalGreedy = 1000; // milliseconds
const PollingIntervalLowProfile = 60000; // milliseconds
const GreedyPingCount = 3;

/**
 * Class that stores measurement data
 */
class Measurement {
    requestSent: number;
    requestReceived: number;
    responseSent: number;
    responseReceived: number;

    constructor(
        requestSent: Date,
        requestReceived: Date,
        responseSent: Date,
        responseReceived: Date
    ) {
        this.requestSent = requestSent.getTime();
        this.requestReceived = requestReceived.getTime();
        this.responseSent = responseSent.getTime();
        this.responseReceived = responseReceived.getTime();
    }

    /**
     * Time offset from remote entity, in milliseconds
     */
    getOffset(): number {
        return ((this.requestReceived - this.requestSent) + (this.responseSent - this.responseReceived)) / 2;
    }

    /**
     * Get round-trip delay, in milliseconds
     */
    getDelay(): number {
        return (this.responseReceived - this.requestSent) - (this.responseSent - this.requestReceived);
    }

    /**
     * Get ping time, in milliseconds
     */
    getPing(): number {
        return this.getDelay() / 2;
    }
}

export interface TimeSyncCallbacks {
    onUpdate: (timeOffset: number, ping: number) => void;
}

/**
 * Base class that manages time syncing with remote entity
 */
export class TimeSync {
    private pingStop = true;
    private pollingInterval = PollingIntervalGreedy;
    private poller: NodeJS.Timeout | null = null;
    private pings = 0; // number of pings
    private measurement: Measurement | null = null; // current time sync
    private measurements: Measurement[] = [];

    constructor(private callbacks: TimeSyncCallbacks) { }

    /**
     * Gets status of time sync
     */
    isReady(): boolean {
        return !!this.measurement;
    }

    /**
     * Gets time offset with remote entity, in milliseconds
     */
    getTimeOffset(): number {
        return this.measurement ? this.measurement.getOffset() : 0;
    }

    /**
     * Gets ping time to remote entity, in milliseconds
     */
    getPing(): number {
        return this.measurement ? this.measurement.getPing() : 0;
    }

    /**
     * Updates time offset between remote entity and local entity
     */
    updateTimeOffset(measurement: Measurement): void {
        this.measurements.push(measurement);
        if (this.measurements.length > NumberOfTrackedMeasurements) {
            this.measurements.shift();
        }

        // Pick measurement with minimum delay
        const sortedMeasurements = [...this.measurements];
        sortedMeasurements.sort((a, b) => a.getDelay() - b.getDelay());
        this.measurement = sortedMeasurements[0];
    }

    /**
     * Schedules a ping request to the remote entity. Triggers time offset update.
     * Override this method in subclasses
     */
    async requestPing(): Promise<{
        requestSent: Date;
        requestReceived: Date;
        responseSent: Date;
        responseReceived: Date;
    }> {
        throw new Error('requestPing must be implemented by subclass');
    }

    /**
     * Poller for ping requests
     */
    private internalRequestPing(): void {
        if (!this.poller && !this.pingStop) {
            this.poller = setTimeout(() => {
                this.poller = null;
                this.requestPing()
                    .then((result) => this.onPingResponseCallback(result))
                    .catch((error) => this.onPingRequestErrorCallback(error))
                    .finally(() => this.internalRequestPing());
            }, this.pollingInterval);
        }
    }

    /**
     * Handles a successful ping request
     */
    private onPingResponseCallback(result: {
        requestSent: Date;
        requestReceived: Date;
        responseSent: Date;
        responseReceived: Date;
    }): void {
        const { requestSent, requestReceived, responseSent, responseReceived } = result;
        const measurement = new Measurement(requestSent, requestReceived, responseSent, responseReceived);
        this.updateTimeOffset(measurement);

        // Avoid overloading network
        if (this.pings >= GreedyPingCount) {
            this.pollingInterval = PollingIntervalLowProfile;
        } else {
            this.pings++;
        }

        this.callbacks.onUpdate(this.getTimeOffset(), this.getPing());
    }

    /**
     * Handles a failed ping request
     */
    private onPingRequestErrorCallback(error: any): void {
        console.error('TimeSync ping request failed:', error);
    }

    /**
     * Drops accumulated measurements
     */
    resetMeasurements(): void {
        this.measurement = null;
        this.measurements = [];
    }

    /**
     * Starts the time poller
     */
    startPing(): void {
        this.pingStop = false;
        this.internalRequestPing();
    }

    /**
     * Stops the time poller
     */
    stopPing(): void {
        this.pingStop = true;
        if (this.poller) {
            clearTimeout(this.poller);
            this.poller = null;
        }
    }

    /**
     * Resets poller into greedy mode
     */
    forceUpdate(): void {
        this.stopPing();
        this.pollingInterval = PollingIntervalGreedy;
        this.pings = 0;
        this.startPing();
    }

    /**
     * Converts remote time to local time
     */
    remoteDateToLocal(remote: Date): Date {
        // remote - local = offset
        return new Date(remote.getTime() - this.getTimeOffset());
    }

    /**
     * Converts local time to remote time
     */
    localDateToRemote(local: Date): Date {
        // remote - local = offset
        return new Date(local.getTime() + this.getTimeOffset());
    }
}

