import { fireEvent } from '@testing-library/react';
import { startActivitySession, IDLE_TIMEOUT_MS, ACTIVITY_KEY } from './activity-session';

describe('activity-based session', () => {
    let stop;
    let readStatus;
    let heartbeat;
    let onExpired;
    let start;
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
    const advance = async milliseconds => { jest.advanceTimersByTime(milliseconds); await flush(); };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        localStorage.clear();
        start = Date.now();
        readStatus = jest.fn().mockImplementation(async () => ({
            lastActivityAt: start, serverTime: Date.now(), idleTimeoutMs: IDLE_TIMEOUT_MS,
        }));
        heartbeat = jest.fn().mockResolvedValue({});
        onExpired = jest.fn();
    });
    afterEach(() => { stop?.(); jest.useRealTimers(); });
    const begin = async () => {
        stop = startActivitySession({ readStatus, heartbeat, onExpired });
        await flush();
    };

    test('background checks cannot keep an idle user logged in', async () => {
        await begin();
        await advance(IDLE_TIMEOUT_MS - 1000);
        expect(onExpired).not.toHaveBeenCalled();
        await advance(1000);
        expect(onExpired).toHaveBeenCalledTimes(1);
        expect(heartbeat).not.toHaveBeenCalled();
    });

    test('typing keeps the form session alive for more than two hours', async () => {
        await begin();
        for (let minute = 0; minute < 125; minute++) {
            await advance(60000);
            fireEvent.input(window);
            await flush();
        }
        expect(onExpired).not.toHaveBeenCalled();
        expect(heartbeat).toHaveBeenCalled();
        await advance(IDLE_TIMEOUT_MS);
        expect(onExpired).toHaveBeenCalledTimes(1);
    });

    test('frequent input is throttled and its trailing activity is sent', async () => {
        await begin();
        for (let i = 0; i < 100; i++) fireEvent.keyDown(window);
        expect(heartbeat).not.toHaveBeenCalled();
        await advance(30000);
        expect(heartbeat).toHaveBeenCalledTimes(1);
        await advance(30000);
        expect(heartbeat).toHaveBeenCalledTimes(1);
    });

    test('a late event after sleep cannot revive an expired session', async () => {
        await begin();
        jest.setSystemTime(start + IDLE_TIMEOUT_MS + 1);
        fireEvent.keyDown(window);
        expect(onExpired).toHaveBeenCalledTimes(1);
        expect(heartbeat).not.toHaveBeenCalled();
    });

    test('activity from another tab is shared without inventing a heartbeat', async () => {
        await begin();
        await advance(50 * 60000);
        localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
        fireEvent(window, new StorageEvent('storage', { key: ACTIVITY_KEY, newValue: String(Date.now()) }));
        await advance(20 * 60000);
        expect(onExpired).not.toHaveBeenCalled();
        expect(heartbeat).not.toHaveBeenCalled();
    });

    test('server rejection expires locally but transient failures preserve the form', async () => {
        await begin();
        readStatus.mockRejectedValueOnce(new Error('offline'));
        await advance(30000);
        expect(onExpired).not.toHaveBeenCalled();
        readStatus.mockRejectedValueOnce({ response: { status: 401 } });
        await advance(30000);
        expect(onExpired).toHaveBeenCalledTimes(1);
    });

    test('cleanup prevents timers and pending responses from expiring another route', async () => {
        let resolve;
        readStatus.mockReturnValue(new Promise(done => { resolve = done; }));
        await begin();
        stop();
        resolve({ lastActivityAt: start - IDLE_TIMEOUT_MS, serverTime: start });
        await flush();
        await advance(IDLE_TIMEOUT_MS);
        fireEvent.input(window);
        expect(onExpired).not.toHaveBeenCalled();
        expect(heartbeat).not.toHaveBeenCalled();
    });

    test('mounting with an old server activity does not restart the hour', async () => {
        readStatus.mockResolvedValue({ lastActivityAt: start - 59 * 60000, serverTime: start });
        await begin();
        await advance(60000);
        expect(onExpired).toHaveBeenCalledTimes(1);
    });
});
