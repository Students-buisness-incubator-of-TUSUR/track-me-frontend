export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const ACTIVITY_KEY = 'trackme.lastUserActivity';
const REQUEST_INTERVAL_MS = 30000;
const EVENTS = ['keydown', 'input', 'pointerdown', 'pointermove', 'touchstart', 'scroll', 'wheel'];

// Only user events update activity. Network polls never extend the client deadline.
export function startActivitySession({ readStatus, heartbeat, onExpired }) {
    let stopped = false;
    let initialized = false;
    let pending = false;
    let busy = false;
    let lastActivity = Date.now();
    let lastRequest = 0;

    const readShared = () => {
        try {
            const value = Number(localStorage.getItem(ACTIVITY_KEY));
            return Number.isFinite(value) && value <= Date.now() ? value : 0;
        } catch {
            return 0;
        }
    };
    const writeShared = value => {
        try { localStorage.setItem(ACTIVITY_KEY, String(value)); } catch { /* Storage may be disabled. */ }
    };
    const expire = () => {
        if (stopped) return;
        stop();
        writeShared(0);
        onExpired();
    };
    const isExpired = () => {
        lastActivity = Math.max(lastActivity, readShared());
        return Date.now() - lastActivity >= IDLE_TIMEOUT_MS;
    };
    const request = async () => {
        if (stopped || busy) return;
        busy = true;
        lastRequest = Date.now();
        const sentActivity = lastActivity;
        const sendingActivity = initialized && pending;
        try {
            const status = await (sendingActivity ? heartbeat() : readStatus());
            if (stopped) return;
            if (!initialized) {
                // Server elapsed time avoids depending on synchronized browser/server clocks.
                lastActivity = Date.now() - Math.max(0, status.serverTime - status.lastActivityAt);
                const sharedActivity = readShared();
                pending = sharedActivity > lastActivity;
                lastActivity = Math.max(lastActivity, sharedActivity);
                initialized = true;
            }
            if (sendingActivity && lastActivity === sentActivity) pending = false;
            if (isExpired()) expire();
        } catch (error) {
            if (!stopped && error.response?.status === 401) expire();
            // A temporary network/server failure must not discard an unfinished form.
        } finally {
            busy = false;
        }
    };
    const activity = () => {
        if (stopped || !initialized || document.visibilityState === 'hidden') return;
        if (isExpired()) { expire(); return; }
        lastActivity = Date.now();
        pending = true;
        // Avoid a synchronous localStorage write for every mouse movement.
        if (lastActivity - readShared() >= 1000) writeShared(lastActivity);
        if (Date.now() - lastRequest >= REQUEST_INTERVAL_MS) request();
    };
    const storage = event => {
        if (event.key !== ACTIVITY_KEY || stopped) return;
        if (event.newValue === '0') { expire(); return; }
        lastActivity = Math.max(lastActivity, readShared());
    };
    const tick = () => {
        if (stopped) return;
        if (isExpired()) { expire(); return; }
        if (Date.now() - lastRequest >= REQUEST_INTERVAL_MS) request();
    };
    const stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        EVENTS.forEach(event => window.removeEventListener(event, activity, true));
        window.removeEventListener('storage', storage);
        document.removeEventListener('visibilitychange', tick);
        window.removeEventListener('focus', tick);
    };
    const timer = setInterval(tick, 1000);
    EVENTS.forEach(event => window.addEventListener(event, activity, { capture: true, passive: true }));
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    request();
    return stop;
}
