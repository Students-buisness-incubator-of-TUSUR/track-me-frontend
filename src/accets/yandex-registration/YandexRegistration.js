import React, { useEffect, useRef, useState } from 'react';
import { backendURL } from '../../services/constants';
import { agreement } from './agreement';
import './yandex-registration.css';

const consentLabels = {
    licenseAccepted: 'Принимаю условия лицензионного соглашения',
    policyAccepted: 'Я ознакомился с политикой в отношении обработки данных',
    consent: 'Я даю согласие на обработку персональных данных',
};
export function validateRegistration(values) {
    const errors = {};
    if (!/^[A-Za-z0-9._-]{6,100}$/.test(values.username)) errors.username = 'Введите от 6 до 100 символов: латинские буквы, цифры, _, . или -.';
    if (!['TRACKER', 'ADMIN'].includes(values.role)) errors.role = 'Выберите роль.';
    Object.keys(consentLabels).forEach(key => { if (!values[key]) errors[key] = 'Необходимо подтвердить согласие.'; });
    return errors;
}
async function jsonResponse(response) {
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Сервис регистрации недоступен. Повторите попытку позже.');
    return response.json();
}
export default function YandexRegistration() {
    const [profile, setProfile] = useState(null);
    const [sso, setSso] = useState('');
    const [message, setMessage] = useState('');
    const [values, setValues] = useState({ username: '', role: '', licenseAccepted: false, policyAccepted: false, consent: false });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);
    const dialog = useRef(null);
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const configResponse = await fetch(`${backendURL}/oauth2/social/config`, { credentials: 'include' });
                if (!configResponse.ok) throw new Error('Вход через Google или Яндекс пока недоступен.');
                const config = await jsonResponse(configResponse);
                const url = new URL(config.ssoUri);
                if (!['https:', 'http:'].includes(url.protocol) || (window.location.protocol === 'https:' && url.protocol !== 'https:')) throw new Error('Неверная настройка адреса SSO.');
                const origin = url.origin;
                const response = await fetch(`${origin}/client/social/profile`, { credentials: 'include', cache: 'no-store' });
                if (!response.ok) throw new Error('Не удалось загрузить профиль. Повторите вход через Google или Яндекс.');
                const data = await jsonResponse(response);
                if (active) { setSso(origin); setProfile(data); setMessage(data.message || ''); }
            } catch (error) { if (active) setMessage(error.message); }
        }
        void load();
        return () => { active = false; };
    }, []);
    function change(event) {
        const { name, type, checked, value } = event.target;
        let nextValue = value;
        if (type === 'checkbox') nextValue = checked;
        else if (name === 'username') nextValue = value.replace(/^@/, '');
        const next = { ...values, [name]: nextValue };
        setValues(next);
        setErrors(previous => ({ ...previous, [name]: validateRegistration(next)[name] }));
    }
    async function submit(event) {
        event.preventDefault();
        if (submitting.current) return;
        const next = { ...values, username: values.username.trim().replace(/^@/, '') };
        const validation = validateRegistration(next);
        setErrors(validation);
        if (Object.keys(validation).length) return;
        submitting.current = true; setBusy(true); setMessage('');
        try {
            const response = await fetch(`${sso}/client/social/registration`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json', [profile.csrfHeader]: profile.csrfToken },
                body: JSON.stringify(next),
            });
            const data = await jsonResponse(response);
            if (data.fieldErrors) setErrors(data.fieldErrors);
            setMessage(data.message || (!response.ok ? 'Не удалось завершить регистрацию. Повторите вход через Google или Яндекс.' : ''));
            if (response.ok && data.registered) setProfile(previous => ({ ...previous, pending: false }));
        } catch (error) { setMessage(error.message); }
        finally { submitting.current = false; setBusy(false); }
    }
    const text = agreement.map(paragraph => <p key={paragraph}>{paragraph}</p>);
    return <div className="yandex-registration"><main>
        <h1>Завершение регистрации</h1>
        {message && <output className="notice">{message}</output>}
        {!profile && !message && <output>Загрузка…</output>}
        {profile && !profile.pending && !message && <p className="notice">Сначала подтвердите вход через Google или Яндекс или начните вход повторно: срок регистрации — 10 минут.</p>}
        {profile?.pending && <form onSubmit={submit} noValidate>
            <p className="verified">Подтверждённая почта: {profile.email}</p>
            <div className="field"><label htmlFor="yandex-username">Имя пользователя в Telegram (без @)</label>
                <input id="yandex-username" name="username" placeholder="username" value={values.username} onChange={change} required minLength={6} maxLength={100} aria-invalid={Boolean(errors.username)} aria-describedby="username-error" />
                <p className="error" id="username-error">{errors.username}</p></div>
            <div className="field"><label htmlFor="yandex-role">Роль</label>
                <select id="yandex-role" name="role" value={values.role} onChange={change} required aria-invalid={Boolean(errors.role)} aria-describedby="role-error">
                    <option value="">Выберите роль</option><option value="TRACKER">Трекер</option><option value="ADMIN">Администратор</option>
                </select><p className="error" id="role-error">{errors.role}</p></div>
            <h2><button type="button" className="license-link" onClick={() => dialog.current.showModal()}>Лицензионное соглашение</button></h2>
            <button type="button" className="terms" aria-haspopup="dialog" onClick={() => dialog.current.showModal()}>{text}</button>
            {Object.entries(consentLabels).map(([name, label]) => <div className="check-row" key={name}>
                <label className="check-label"><input type="checkbox" name={name} checked={values[name]} onChange={change} required aria-invalid={Boolean(errors[name])} aria-describedby={`${name}-error`} /><span>{label}</span></label>
                <p className="error" id={`${name}-error`}>{errors[name]}</p></div>)}
            <button className="primary" type="submit" disabled={busy || Object.keys(validateRegistration(values)).length > 0}>{busy ? 'Отправка…' : 'Завершить регистрацию'}</button>
            <p className="registration-note">После регистрации аккаунт активирует администратор.</p>
        </form>}
        <dialog ref={dialog} aria-labelledby="yandex-license-title"><button type="button" className="license-close" aria-label="Закрыть соглашение" onClick={() => dialog.current.close()}>×</button><h2 id="yandex-license-title">Пользовательское соглашение</h2><div className="license-full-text">{text}</div></dialog>
    </main></div>;
}
