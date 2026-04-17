# React Frontend (Vite)

This frontend now uses React + Vite.

## Features

- API base URL config (saved in localStorage)
- Register / Login / Logout / Profile
- Category create/list/delete
- Task create/list/delete with optional category
- Live logs panel

## Run

From `webservice-cloud-template/frontend`:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Backend requirements

- Backend should be running (`app` service)
- CORS should be enabled (already set in backend `main.ts`)
- Authenticated routes require Bearer token from login/register
