# Frontend

This directory contains the React 19 and Vite dashboard for the Poultry Management System. The application loads data from the backend API at `http://localhost:5000/api` and provides house selection, dashboard statistics, house forms, daily-record forms, and confirmation dialogs.

## Commands

Run these commands from this directory:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

The main application state is in `src/App.jsx`. Reusable forms and dialogs are in `src/components/`, and HTTP calls are in `src/services/api.js`. See the repository root [README](../README.md) and [contribution guide](../CONTRIBUTING.md) for the complete architecture.
