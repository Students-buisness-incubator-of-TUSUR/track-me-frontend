import axios from 'axios';
import { getCsrfConfig } from '../utils/csrf-utils';
import { reportUserActivity } from './session-api';

jest.mock('axios', () => ({ create: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })) }));
jest.mock('../utils/csrf-utils', () => ({ getCsrfConfig: jest.fn() }));
const api = axios.create.mock.results[0].value;

beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    getCsrfConfig.mockReturnValue({ headers: { 'X-CSRF-TOKEN': 'old' } });
});

test('renews a rejected CSRF token and retries activity once', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 403 } }).mockResolvedValueOnce({ data: { ok: true } });
    api.get.mockResolvedValueOnce({ data: { headerName: 'X-CSRF-TOKEN', token: 'fresh' } });
    await expect(reportUserActivity()).resolves.toEqual({ ok: true });
    expect(api.get).toHaveBeenCalledWith('/csrf');
    expect(api.post).toHaveBeenLastCalledWith('/session/activity', {}, { headers: { 'X-CSRF-TOKEN': 'fresh' } });
    expect(api.post).toHaveBeenCalledTimes(2);
});

test('does not retry expired authentication', async () => {
    const failure = { response: { status: 401 } };
    api.post.mockRejectedValueOnce(failure);
    await expect(reportUserActivity()).rejects.toBe(failure);
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
});

test('propagates a repeated forbidden response instead of looping', async () => {
    const failure = { response: { status: 403 } };
    api.post.mockRejectedValue(failure);
    api.get.mockResolvedValueOnce({ data: { headerName: 'X-CSRF-TOKEN', token: 'fresh' } });
    await expect(reportUserActivity()).rejects.toBe(failure);
    expect(api.post).toHaveBeenCalledTimes(2);
});

test('obtains a token when local storage has none', async () => {
    getCsrfConfig.mockReturnValue({});
    api.get.mockResolvedValueOnce({ data: { headerName: 'X-CSRF-TOKEN', token: 'fresh' } });
    api.post.mockResolvedValueOnce({ data: {} });
    await reportUserActivity();
    expect(api.post).toHaveBeenCalledWith('/session/activity', {}, { headers: { 'X-CSRF-TOKEN': 'fresh' } });
});
