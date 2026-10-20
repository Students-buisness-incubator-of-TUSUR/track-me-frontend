import React, { useRef } from 'react';
import { agreement } from './agreement';

const consentLabels = {
    licenseAccepted: 'Принимаю условия лицензионного соглашения',
    policyAccepted: 'Подтверждаю ознакомление с политикой обработки персональных данных',
    consent: 'Даю согласие на обработку персональных данных',
};

function Brand() {
    return <a className="registration-brand" href="/" aria-label="TrackMe — главная">
        <svg viewBox="0 0 32 36" aria-hidden="true" fill="none">
            <path d="M16 2 29 9.5v17L16 34 3 26.5v-17L16 2Z" />
            <path d="m3 9.5 13 7.5 13-7.5M16 17v17M8 12.5V23l8 4.5 8-4.5V12.5M8 17l8 4.5 8-4.5M9 9.5l7-4 7 4-7 4-7-4Z" />
        </svg><span>TrackMe</span>
    </a>;
}

function FieldError({ name, children }) {
    return children ? <p className="field-error" id={`${name}-error`}><span aria-hidden="true">ⓘ</span> {children}</p> : null;
}

export default function RegistrationView({ profile, sso, values, errors, busy, message, registered, onChange, onBlur, onSubmit }) {
    const dialog = useRef(null);
    const provider = profile?.provider === 'google' ? 'Google' : 'Яндекс';
    const openLicense = () => dialog.current.showModal();
    const closeLicense = () => dialog.current.close();
    const consentError = ['licenseAccepted', 'policyAccepted', 'consent'].some(key => errors[key]);
    const canSubmit = values.username.length >= 6 && ['TRACKER', 'ADMIN'].includes(values.role)
        && values.licenseAccepted && values.policyAccepted && values.consent
        && !Object.values(errors).some(Boolean);
    const loginUri = sso ? `${sso}/client/login` : '/';

    function acceptLicense() {
        onChange({ target: { name: 'licenseAccepted', type: 'checkbox', checked: true } });
        closeLicense();
    }

    return <div className="yandex-registration">
        <Brand />
        <main className={registered ? 'registration-card registration-success' : 'registration-card'}>
            {registered ? <>
                <svg className="success-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m18 32 9 9 19-20" /></svg>
                <h1>Заявка принята</h1>
                <p className="registration-intro">Вы зарегистрированы с почтой <strong>{profile?.email}</strong>.</p>
                <section className="next-steps" aria-labelledby="next-steps-title">
                    <h2 id="next-steps-title">Что дальше</h2>
                    <ol><li>Администратор программы проверит заявку и подтвердит роль.</li><li>После активации аккаунта вы сможете войти через {provider}.</li></ol>
                </section>
                <a className="return-login" href={loginUri}>Вернуться на страницу входа</a>
            </> : <>
                <h1>Завершите регистрацию</h1>
                {message && <output className="registration-notice">{message}</output>}
                {!profile && !message && <output className="registration-notice">Загрузка…</output>}
                {profile && !profile.pending && !message && <p className="registration-notice">Сначала подтвердите вход через Google или Яндекс или начните вход повторно: срок регистрации — 10 минут.</p>}
                {profile?.pending && <>
                    <p className="registration-intro">Вы вошли через {provider} как <strong>{profile.email}</strong>.<br />Осталось указать данные для TrackMe.</p>
                    <form onSubmit={onSubmit} noValidate>
                        <div className="registration-field">
                            <label htmlFor="yandex-username">Имя пользователя в Telegram</label>
                            <div className="username-input"><span aria-hidden="true">@</span><input id="yandex-username" name="username" placeholder="username" autoComplete="username" value={values.username} onChange={onChange} onBlur={onBlur} required minLength={6} maxLength={100} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : 'username-hint'} /></div>
                            <FieldError name="username">{errors.username}</FieldError>
                            {!errors.username && <p className="field-hint" id="username-hint">Без @. Латиница, цифры, точка, дефис или подчёркивание, от 6 символов</p>}
                        </div>
                        <div className="registration-field">
                            <label htmlFor="social-phone">Телефон</label>
                            <input id="social-phone" name="phoneNumber" type="tel" autoComplete="tel" placeholder="+7 913 123-45-67" value={values.phoneNumber} onChange={onChange} onBlur={onBlur} aria-invalid={Boolean(errors.phoneNumber)} aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : 'phone-hint'} />
                            <FieldError name="phoneNumber">{errors.phoneNumber}</FieldError>
                            {!errors.phoneNumber && <p className="field-hint" id="phone-hint">{profile.phoneNumber ? `Взяли из ${provider} ID. Если номер другой — исправьте` : 'Необязательно. Укажите номер для связи'}</p>}
                        </div>
                        <div className="registration-field role-field">
                            <label htmlFor="yandex-role">Роль</label>
                            <div className="select-input"><select id="yandex-role" name="role" value={values.role} onChange={onChange} onBlur={onBlur} required aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? 'role-error' : 'role-hint'}>
                                <option value="">Выберите роль</option><option value="TRACKER">Трекер</option><option value="ADMIN">Администратор</option>
                            </select><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg></div>
                            <FieldError name="role">{errors.role}</FieldError>
                            {!errors.role && <p className="field-hint" id="role-hint">Роль подтвердит администратор программы</p>}
                        </div>
                        <div className="registration-consents">
                            {Object.entries(consentLabels).map(([name, label]) => <div className="consent-row" key={name}>
                                <input id={`social-${name}`} type="checkbox" name={name} checked={values[name]} onChange={onChange} required aria-label={label} aria-invalid={Boolean(errors[name])} aria-describedby={consentError ? 'consents-error' : undefined} />
                                {name === 'licenseAccepted' ? <span><label htmlFor={`social-${name}`}>Принимаю условия </label><button type="button" className="license-link" onClick={openLicense}>лицензионного соглашения</button></span> : <label htmlFor={`social-${name}`}>{label}{name === 'policyAccepted' && ' (раздел лицензионного соглашения)'}</label>}
                            </div>)}
                            {consentError && <FieldError name="consents">Отметьте все три пункта, чтобы продолжить</FieldError>}
                        </div>
                        <button className="registration-primary" type="submit" disabled={busy || !canSubmit}>{busy ? 'Отправка…' : 'Завершить регистрацию'}</button>
                        <p className="registration-note">Войти через {provider} можно будет после того, как администратор подтвердит аккаунт.</p>
                    </form>
                    <div className="registration-divider"><span>или</span></div>
                    <details className="existing-account"><summary>У меня уже есть аккаунт TrackMe<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg></summary><p>Войдите в существующий аккаунт с помощью логина и пароля. Повторная регистрация не требуется.</p></details>
                    <a className="return-login" href={loginUri}>Войти по почте и паролю</a>
                </>}
            </>}
        </main>
        <dialog className="registration-license" ref={dialog} aria-labelledby="yandex-license-title">
            <header><h2 id="yandex-license-title">Лицензионное соглашение</h2><button type="button" className="license-close" aria-label="Закрыть соглашение" onClick={closeLicense}>×</button></header>
            <div className="license-full-text" tabIndex="0">{agreement.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
            <footer><button type="button" className="license-dismiss" onClick={closeLicense}>Закрыть</button><button type="button" className="license-accept" onClick={acceptLicense}>Принимаю условия</button></footer>
        </dialog>
    </div>;
}
