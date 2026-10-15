import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

test('Yandex login returns to after-login to initialize the TrackMe profile', () => {
    const original = window.location;
    delete window.location;
    window.location = { origin: 'https://trackme.example', href: '' };
    try {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        fireEvent.click(screen.getByAltText('Yandex').closest('button'));
        const target = new URL(window.location.href);
        expect(target.pathname).toBe('/oauth2/authorization/yandex');
        expect(target.searchParams.get('redirect_uri')).toBe('https://trackme.example/after-login');
    } finally { window.location = original; }
});
