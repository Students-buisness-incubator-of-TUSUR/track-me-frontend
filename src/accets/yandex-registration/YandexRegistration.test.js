import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import YandexRegistration, { validateRegistration } from './YandexRegistration';

const valid = { username: 'newuser', role: 'TRACKER', licenseAccepted: true, policyAccepted: true, consent: true, phoneNumber: '' };
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
    await screen.findByText('test@yandex.ru');
    const button = screen.getByRole('button', { name: 'Завершить регистрацию' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Роль')).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Имя пользователя/), { target: { value: '@newuser' } });
    expect(screen.getByLabelText(/Имя пользователя/)).toHaveValue('newuser');
    fireEvent.change(screen.getByLabelText('Роль'), { target: { value: 'TRACKER' } });
    screen.getAllByRole('checkbox').forEach(box => { expect(box).not.toBeChecked(); fireEvent.click(box); });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Заявка принята' });
    expect(global.fetch).toHaveBeenLastCalledWith('http://localhost:9000/client/social/registration', expect.objectContaining({
        credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf' }, body: JSON.stringify(valid),
    }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
test('opens agreement in place and closes it', async () => {
    render(<YandexRegistration />);
    await screen.findByText('test@yandex.ru');
    fireEvent.click(screen.getByRole('button', { name: /лицензионного соглашения/ }));
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
    expect(await screen.findByText('Нет связи с SSO')).toBeInTheDocument();
});

test('Google uses the same registration fields as Yandex', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(response({ ssoUri: 'http://localhost:9000' }))
        .mockResolvedValueOnce(response({ pending: true, provider: 'google', email: 'test@gmail.com', phoneNumber: '+79001234567', csrfHeader: 'X-CSRF-TOKEN', csrfToken: 'csrf' }));
    render(<YandexRegistration />);
    expect(await screen.findByText(/test@gmail.com/)).toBeInTheDocument();
    expect(document.getElementById('yandex-username')).toBeInTheDocument();
    expect(document.getElementById('yandex-role')).toBeInTheDocument();
    expect(screen.getByLabelText('Телефон')).toHaveValue('+79001234567');
});

test('accepting the license in the dialog checks only its own consent', async () => {
    render(<YandexRegistration />);
    await screen.findByText('test@yandex.ru');
    fireEvent.click(screen.getByRole('button', { name: /лицензионного соглашения/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Принимаю условия', hidden: true }));
    expect(screen.getByRole('checkbox', { name: 'Принимаю условия лицензионного соглашения' })).toBeChecked();
    expect(screen.getAllByRole('checkbox').filter(box => box.checked)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Завершить регистрацию' })).toBeDisabled();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
});

test('validates optional formatted phone and shows field errors on blur', async () => {
    expect(validateRegistration({ ...valid, phoneNumber: '+7 (913) 123-45-67' })).not.toHaveProperty('phoneNumber');
    expect(validateRegistration({ ...valid, phoneNumber: 'bad' })).toHaveProperty('phoneNumber');
    render(<YandexRegistration />);
    await screen.findByText('test@yandex.ru');
    fireEvent.change(screen.getByLabelText(/Имя пользователя/), { target: { value: 'ivan' } });
    expect(screen.getByText(/Слишком короткое имя/)).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('Роль'));
    expect(screen.getByText('Выберите роль.')).toBeInTheDocument();
});
