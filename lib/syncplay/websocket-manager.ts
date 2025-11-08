/**
 * WebSocket connection manager for SyncPlay
 * Handles connection, disconnection, keep-alive, and message sending
 */

export interface WebSocketManagerCallbacks {
    onOpen: () => void;
    onMessage: (message: any) => void;
    onClose: () => void;
    onError: (error: Event) => void;
}

export class WebSocketManager {
    private ws: WebSocket | null = null;
    private keepAliveInterval: NodeJS.Timeout | null = null;
    private isConnecting = false;

    constructor(
        private serverUrl: string,
        private accessToken: string,
        private deviceId: string,
        private callbacks: WebSocketManagerCallbacks
    ) { }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        try {
            // Construct WebSocket URL exactly like Jellyfin web client
            let wsUrl = this.serverUrl;
            wsUrl = wsUrl.replace('https:', 'wss:');
            wsUrl = wsUrl.replace('http:', 'ws:');
            wsUrl = wsUrl.replace(/\/$/, '') + '/socket';
            wsUrl += `?api_key=${this.accessToken}`;
            wsUrl += `&deviceId=${this.deviceId}`;

            console.log('Creating WebSocket connection...', wsUrl);
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('web socket connection opened');
                this.isConnecting = false;
                this.callbacks.onOpen();
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.callbacks.onMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = (event) => {
                console.log('web socket closed', {
                    code: event.code,
                    reason: event.reason || 'No reason provided',
                    wasClean: event.wasClean
                });
                this.clearKeepAlive();
                this.isConnecting = false;
                this.ws = null;
                this.callbacks.onClose();
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket connection error:', error);
                console.error('WebSocket URL was:', wsUrl);
                this.isConnecting = false;
                this.callbacks.onError(error);
            };

            this.ws = ws;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.callbacks.onError(error as Event);
        }
    }

    disconnect(): void {
        console.trace('Disconnecting WebSocket...');
        this.clearKeepAlive();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        this.ws = null;
        this.isConnecting = false;
    }

    send(messageType: string, data?: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`Sending web socket message: ${messageType}`);
            const message = {
                MessageType: messageType,
                Data: data
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    scheduleKeepAlive(timeout: number): void {
        this.clearKeepAlive();
        const intervalMs = timeout * 1000 * 0.5;
        console.debug(`Scheduling KeepAlive every ${intervalMs}ms (timeout: ${timeout}s)`);
        this.keepAliveInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send('KeepAlive');
            } else {
                console.warn('WebSocket not open, clearing KeepAlive interval');
                this.clearKeepAlive();
            }
        }, intervalMs);
    }

    clearKeepAlive(): void {
        if (this.keepAliveInterval) {
            console.debug('Clearing KeepAlive interval', {
                wsState: this.ws?.readyState,
                wsUrl: this.ws?.url
            });
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    get readyState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

