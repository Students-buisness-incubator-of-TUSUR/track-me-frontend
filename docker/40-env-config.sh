#!/bin/sh
# Генерирует env-config.js из переменных окружения контейнера при каждом старте,
# чтобы один и тот же образ работал на dev и prod (адрес API не зашит в сборку).
set -eu

TARGET=/usr/share/nginx/html/env-config.js

# Экранируем \ и " для вставки в JS-строку.
escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

printf 'window._env_ = {\n  REACT_APP_BACKEND_URI: "%s"\n};\n' \
    "$(escape "${REACT_APP_BACKEND_URI:-}")" > "$TARGET"

echo "env-config.js: REACT_APP_BACKEND_URI=${REACT_APP_BACKEND_URI:-<не задан>}"
