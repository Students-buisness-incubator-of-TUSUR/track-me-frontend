import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

test.each(['Yandex', 'Google'])('%s login returns to after-login to initialize the TrackMe profile', provider => {
    const original = window.location;
    delete window.location;
    window.location = { origin: 'https://trackme.example', href: '' };
    try {
        render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HomePage /></MemoryRouter>);
        fireEvent.click(screen.getByAltText(provider).closest('button'));
        const target = new URL(window.location.href);
        expect(target.pathname).toBe(`/oauth2/authorization/${provider.toLowerCase()}`);
        expect(target.searchParams.get('redirect_uri')).toBe('https://trackme.example/after-login');
    } finally { window.location = original; }
});
