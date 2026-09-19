import axios from 'axios';
import { getCsrfConfig } from '../utils/csrf-utils';

const api = axios.create({
    baseURL: process.env.REACT_APP_BACKEND_URI || 'http://localhost:8081',
    withCredentials: true,
    timeout: 10000,
    headers: { Accept: 'application/json' },
});

export const readSessionStatus = async () => (await api.get('/session/status')).data;
export const reportUserActivity = async () => {
    let config = getCsrfConfig();
    if (!config.headers) {
        const { data } = await api.get('/csrf');
        config = { headers: { [data.headerName]: data.token } };
    }
    return (await api.post('/session/activity', {}, config)).data;
};
