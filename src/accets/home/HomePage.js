import React from "react";
import "./HomePage.css";

import {useLocation } from 'react-router-dom';
import { getBackendUri } from "../../utils/runtime-env";

const HomePage = () => {
    const clientGatewayUri = getBackendUri() || "http://localhost:8081";
    
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const sessionExpired = queryParams.get('sessionExpired') === 'true';
    const handleSSOLogin = () => {

        window.location.href = `${clientGatewayUri}/oauth2/authorization/track-me-client?redirect_uri=${encodeURIComponent(window.location.origin + '/after-login')}`;
    };


    const handleYandexLogin = () => {
        window.location.href = `${clientGatewayUri}/oauth2/authorization/yandex`;
    };

    const handleGoogleLogin = () => {
        window.location.href = `${clientGatewayUri}/oauth2/authorization/google`;
    };

    return (
        <div className="home-container">
            <div className="home-box">
                {sessionExpired && (
                <div className="session-expired">
                    Ваша сессия истекла. Пожалуйста, авторизируйтесь заново.
                </div>
            )}
                <h1 className="home-title">Добро пожаловать в TrackMe</h1>
                <p className="home-description">Управляйте своими потоками и командами с
                    легкостью.</p>
                <div className="home-provider-buttons">
                    <button className="home-provider-button" onClick={handleGoogleLogin}>
                        <img src="/icons/google-logo.svg" alt="Google"/>
                    </button>
                    <button className="home-provider-button" onClick={handleYandexLogin}>
                        <img src="/icons/yandex-logo-rus.svg" alt="Yandex"/>
                    </button>
                </div>
                <button className="home-sso-button" onClick={handleSSOLogin}>
                    Войти через SSO
                </button>
            </div>
        </div>
    );
};

export default HomePage;