export type Listener = (...args: any[]) => void;

export class EventEmitter {
    private listeners: { [event: string]: Listener[] } = {};

    on(event: string, listener: Listener): this {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
        return this;
    }

    off(event: string, listener: Listener): this {
        if (!this.listeners[event]) return this;
        this.listeners[event] = this.listeners[event].filter(l => l !== listener);
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        if (!this.listeners[event]) return false;
        this.listeners[event].forEach(l => l(...args));
        return true;
    }

    addListener(event: string, listener: Listener): this {
        return this.on(event, listener);
    }

    removeListener(event: string, listener: Listener): this {
        return this.off(event, listener);
    }

    removeAllListeners(event?: string): this {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
        return this;
    }
}
