# Сборка и развёртывание фронтенда

## Образ

`Dockerfile` собирает статический бандл (`npm run build`) и раздаёт его через nginx на порту **3000**
(`docker/nginx.conf`: SPA-fallback на `index.html`, долгий кеш для `/static/`, без кеша для
`index.html` и `env-config.js`).

Адрес API **не зашит в сборку**. При старте контейнера `docker/40-env-config.sh` пишет
`/env-config.js` (`window._env_`) из переменной окружения `REACT_APP_BACKEND_URI`, а код читает его
через `getBackendUri()` (`src/utils/runtime-env.js`). Поэтому один и тот же образ едет на dev и prod.

```bash
docker build -t trackme-frontend .
docker run --rm -p 3000:3000 -e REACT_APP_BACKEND_URI=http://localhost:8081 trackme-frontend
```

При `npm start` используется заглушка `public/env-config.js` и значение из `.env.local`
(fallback на `process.env.REACT_APP_BACKEND_URI`).

## Ветки и теги образов

| Ветка / ref | Образ (`ghcr.io/students-buisness-incubator-of-tusur/track-me-frontend`) | Куда |
|---|---|---|
| `develop` | `:<sha>`, `:develop`, `:latest` | dev — авто (`deploy-dev.yml`) |
| `main` | `:<sha>`, `:main` | — |
| тег `vX.Y.Z` (на `main`) | `:<sha>`, `:vX.Y.Z` | prod — по GitHub Release (`deploy-prod.yml`) |

`:latest` двигается только из `develop`.

## Релиз на prod

Prod-стенд (`~/track-me-prod`, домен `trackme.startup-poligon.com`) разворачивает монорепо
`track-me`; этот репозиторий обновляет в нём только сервис `trackme-frontend`.

1. Влить `develop → main` через PR, дождаться зелёного CI.
2. Тег на `main`: `git tag -a v1.2.3 -m "Release 1.2.3" && git push origin v1.2.3`; дождаться сборки образа `:v1.2.3`.
3. Опубликовать GitHub Release из тега → **Deploy to PROD** → апрув в окружении `production`.

Workflow прописывает `FRONTEND_IMAGE=…:vX.Y.Z` в `~/track-me-prod/.env` и пересоздаёт только
`trackme-frontend` (`up -d --no-deps`). `REACT_APP_BACKEND_URI` берётся из того же `.env`
(`https://api.trackme.startup-poligon.com`).

**Откат:** Actions → Deploy to PROD → Run workflow → `tag` = предыдущий релиз.

## Разовая настройка GitHub

- Ветка релизов — `main` (Settings → Branches → переименовать `master`; защита ветки переносится).
- Environment **`production`**: required reviewers; Deployment branches and tags → `main` + тег `v*`.
- Секреты SSH (`SBI_SSH_HOST`, `SBI_SSH_USERNAME`, `SBI_SSH_PRIVATE_KEY`) — те же, что у dev.
