import axios from 'axios';
import { logoutSession } from './logout-session';

jest.mock('axios', () => ({ get: jest.fn() }));

describe('logoutSession', () => {
    let submit;
    beforeEach(() => {
        localStorage.clear();
        submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('posts the fresh CSRF token as a browser navigation and clears local state', async () => {
        axios.get.mockResolvedValue({ data: { parameterName: '_csrf', token: 'fresh-token' } });
        localStorage.setItem('user', 'user');
        submit.mockImplementation(function () {
            expect(this.method).toBe('post');
            expect(this.action).toMatch(/\/logout$/);
            expect(this.querySelector('input[name="_csrf"]').value).toBe('fresh-token');
            expect(document.body.contains(this)).toBe(true);
        });
        await logoutSession();
        expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/csrf$/), { withCredentials: true });
        expect(submit).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('user')).toBeNull();
        expect(document.querySelector('form')).toBeNull();
    });

    it('preserves the current user when CSRF retrieval fails', async () => {
        axios.get.mockRejectedValue(new Error('offline'));
        localStorage.setItem('user', 'user');
        await expect(logoutSession()).rejects.toThrow('offline');
        expect(submit).not.toHaveBeenCalled();
        expect(localStorage.getItem('user')).toBe('user');
    });

    it('rejects invalid CSRF responses without sending logout', async () => {
        axios.get.mockResolvedValue({ data: { parameterName: 'unexpected', token: 'token' } });
        await expect(logoutSession()).rejects.toThrow('Missing logout CSRF token');
        expect(submit).not.toHaveBeenCalled();
    });
});
