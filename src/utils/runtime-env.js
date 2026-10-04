// Адрес gateway берётся в рантайме: в Docker-образе entrypoint пишет env-config.js
// (window._env_) из переменной окружения контейнера, поэтому один и тот же образ работает
// на dev и prod. При `npm start` / в тестах — fallback на process.env (сборочное значение CRA).
export const getBackendUri = () =>
    (typeof window !== 'undefined' && window._env_?.REACT_APP_BACKEND_URI) ||
    process.env.REACT_APP_BACKEND_URI;
