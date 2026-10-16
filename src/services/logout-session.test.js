import { logoutSession } from './logout-session';


describe('logoutSession', () => {
    let submit;
    const originalFetch = global.fetch;
    beforeEach(() => {
        localStorage.clear();
        global.fetch = jest.fn();
        submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it('posts the fresh CSRF token as a browser navigation and clears local state', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ parameterName: '_csrf', token: 'fresh-token' }) });
        localStorage.setItem('user', 'user');
        submit.mockImplementation(function () {
            expect(this.method).toBe('post');
            expect(this.action).toMatch(/\/logout$/);
            expect(this.querySelector('input[name="_csrf"]').value).toBe('fresh-token');
            expect(document.body.contains(this)).toBe(true);
        });
        await logoutSession();
        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/csrf$/), { credentials: 'include' });
        expect(submit).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('user')).toBeNull();
        expect(document.querySelector('form')).toBeNull();
    });

    it('preserves the current user when CSRF retrieval fails', async () => {
        global.fetch.mockRejectedValue(new Error('offline'));
        localStorage.setItem('user', 'user');
        await expect(logoutSession()).rejects.toThrow('offline');
        expect(submit).not.toHaveBeenCalled();
        expect(localStorage.getItem('user')).toBe('user');
    });

    it('rejects invalid CSRF responses without sending logout', async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ parameterName: 'unexpected', token: 'token' }) });
        await expect(logoutSession()).rejects.toThrow('Missing logout CSRF token');
        expect(submit).not.toHaveBeenCalled();
    });

    it('does not submit logout when the CSRF endpoint returns an error', async () => {
        global.fetch.mockResolvedValue({ ok: false });
        await expect(logoutSession()).rejects.toThrow('Failed to retrieve logout CSRF token');
        expect(submit).not.toHaveBeenCalled();
    });
});
