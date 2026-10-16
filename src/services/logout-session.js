import { backendURL } from './constants';
import { ACTIVITY_KEY } from './activity-session';

export async function logoutSession() {
    const response = await fetch(`${backendURL}/csrf`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to retrieve logout CSRF token');
    const data = await response.json();
    if (data.parameterName !== '_csrf' || typeof data.token !== 'string' || !data.token) {
        throw new Error('Missing logout CSRF token');
    }
    // A browser form follows the gateway and SSO redirects as page navigations.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${backendURL}/logout`;
    form.hidden = true;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = data.token;
    form.appendChild(input);
    document.body.appendChild(form);
    try {
        form.submit();
        ['user', 'userRole', 'streamName', 'streamId', 'streamSDate', 'streamEDate',
            'csrfToken', 'csrfHeaderName', ACTIVITY_KEY].forEach(key => localStorage.removeItem(key));
    } finally {
        form.remove();
    }
}
