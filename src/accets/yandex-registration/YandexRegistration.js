import React, { useEffect, useRef, useState } from 'react';
import { backendURL } from '../../services/constants';
import RegistrationView from './RegistrationView';
import './yandex-registration.css';

const consentLabels = {
    licenseAccepted: 'Принимаю условия лицензионного соглашения',
    policyAccepted: 'Я ознакомился с политикой в отношении обработки данных',
    consent: 'Я даю согласие на обработку персональных данных',
};
export function validateRegistration(values) {
    const errors = {};
    if (values.username.length < 6) errors.username = 'Слишком короткое имя — нужно от 6 символов';
    else if (!/^[A-Za-z0-9._-]{6,100}$/.test(values.username)) errors.username = 'Введите от 6 до 100 символов: латинские буквы, цифры, _, . или -.';
    if (!['TRACKER', 'ADMIN'].includes(values.role)) errors.role = 'Выберите роль.';
    Object.keys(consentLabels).forEach(key => { if (!values[key]) errors[key] = 'Необходимо подтвердить согласие.'; });
    if (values.phoneNumber && !/^\+?\d{10,15}$/.test(normalizePhone(values.phoneNumber))) errors.phoneNumber = 'Введите от 10 до 15 цифр; в начале допустим +.';
    return errors;
}
export function normalizePhone(value) {
    return value.replace(/[\s()-]/g, '');
}
async function jsonResponse(response) {
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Сервис регистрации недоступен. Повторите попытку позже.');
    return response.json();
}
export default function YandexRegistration() {
    const [profile, setProfile] = useState(null);
    const [sso, setSso] = useState('');
    const [message, setMessage] = useState('');
    const [values, setValues] = useState({ username: '', role: '', licenseAccepted: false, policyAccepted: false, consent: false, phoneNumber: '' });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [registered, setRegistered] = useState(false);
    const submitting = useRef(false);
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
                if (active) { setSso(origin); setProfile(data); setMessage(data.message || ''); setValues(previous => ({ ...previous, phoneNumber: data.phoneNumber || '' })); }
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
    function blur(event) {
        const { name } = event.target;
        setErrors(previous => ({ ...previous, [name]: validateRegistration(values)[name] }));
    }
    async function submit(event) {
        event.preventDefault();
        if (submitting.current) return;
        const next = { ...values, username: values.username.trim().replace(/^@/, ''), phoneNumber: normalizePhone(values.phoneNumber) };
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
            if (response.ok && data.registered) { setRegistered(true); setProfile(previous => ({ ...previous, pending: false })); }
        } catch (error) { setMessage(error.message); }
        finally { submitting.current = false; setBusy(false); }
    }
    return <RegistrationView profile={profile} sso={sso} values={values} errors={errors} busy={busy}
        message={message} registered={registered} onChange={change} onBlur={blur} onSubmit={submit} />;
}
