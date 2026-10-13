import axios from 'axios';
import { getCsrfConfig } from '../utils/csrf-utils';

const api = axios.create({
    baseURL: process.env.REACT_APP_BACKEND_URI || 'http://localhost:8081',
    withCredentials: true,
    timeout: 10000,
    headers: { Accept: 'application/json' },
});

export const readSessionStatus = async () => (await api.get('/session/status')).data;
const freshCsrfConfig = async () => {
    const { data } = await api.get('/csrf');
    return { headers: { [data.headerName]: data.token } };
};

export const reportUserActivity = async () => {
    let config = getCsrfConfig();
    if (!config.headers) config = await freshCsrfConfig();
    try {
        return (await api.post('/session/activity', {}, config)).data;
    } catch (error) {
        if (error.response?.status !== 403) throw error;
        // A different tab or a new login may have replaced the session's CSRF token.
        return (await api.post('/session/activity', {}, await freshCsrfConfig())).data;
    }
};
