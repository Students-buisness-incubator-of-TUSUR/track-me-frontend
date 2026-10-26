// Заглушка для `npm start`: в Docker-образе файл перезаписывается при старте контейнера
// значением переменной окружения REACT_APP_BACKEND_URI (см. docker/40-env-config.sh).
window._env_ = {};
