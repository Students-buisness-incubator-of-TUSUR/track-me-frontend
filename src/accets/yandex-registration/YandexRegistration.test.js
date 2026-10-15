import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YandexRegistration, { validateRegistration } from './YandexRegistration';

const valid = { username: 'newuser', role: 'TRACKER', licenseAccepted: true, policyAccepted: true, consent: true };
const response = (data, ok = true) => ({ ok, headers: { get: () => 'application/json' }, json: async () => data });
beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ssoUri: 'http://localhost:9000' }))
        .mockResolvedValueOnce(response({ pending: true, email: 'test@yandex.ru', csrfHeader: 'X-CSRF-TOKEN', csrfToken: 'csrf' }));
    HTMLDialogElement.prototype.showModal = jest.fn();
    HTMLDialogElement.prototype.close = jest.fn();
});
afterEach(() => jest.restoreAllMocks());
test.each(['licenseAccepted', 'policyAccepted', 'consent'])('requires %s independently', key => {
    expect(validateRegistration({ ...valid, [key]: false })).toHaveProperty(key);
});
test('rejects privileged roles and malformed usernames', () => {
    expect(validateRegistration({ ...valid, role: 'SUPER_ADMIN', username: '@' })).toHaveProperty('role');
    expect(validateRegistration({ ...valid, username: 'a' })).toHaveProperty('username');
});
test('loads confirmed profile, strips @, requires all consents and submits with session CSRF', async () => {
    global.fetch.mockResolvedValueOnce(response({ registered: true, message: 'Аккаунт ожидает активации' }));
    render(<YandexRegistration />);
    await screen.findByText(/Подтверждённая почта/);
    const button = screen.getByRole('button', { name: 'Завершить регистрацию' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Роль')).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Имя пользователя/), { target: { value: '@newuser' } });
    expect(screen.getByLabelText(/Имя пользователя/)).toHaveValue('newuser');
    fireEvent.change(screen.getByLabelText('Роль'), { target: { value: 'TRACKER' } });
    screen.getAllByRole('checkbox').forEach(box => { expect(box).not.toBeChecked(); fireEvent.click(box); });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await screen.findByText('Аккаунт ожидает активации');
    expect(global.fetch).toHaveBeenLastCalledWith('http://localhost:9000/client/yandex/registration', expect.objectContaining({
        credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf' }, body: JSON.stringify(valid),
    }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
test('opens agreement in place and closes it', async () => {
    render(<YandexRegistration />);
    await screen.findByText(/Подтверждённая почта/);
    fireEvent.click(screen.getByRole('button', { name: 'Лицензионное соглашение' }));
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Закрыть соглашение'));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
});
test('does not display registration when the pending session is missing', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ssoUri: 'http://localhost:9000' }))
        .mockResolvedValueOnce(response({ pending: false }));
    render(<YandexRegistration />);
    await screen.findByText(/Сначала подтвердите/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
test('shows loading errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Нет связи с SSO'));
    render(<YandexRegistration />);
    await screen.findByText('Нет связи с SSO');
});
