# Poultry Management System — Frontend Client

This directory contains the React 19 + Vite dashboard application for the Poultry Management System.

## Overview

The frontend connects to the backend REST API and provides an intuitive farm management experience with:
- **Authentication & Authorization:** Secure modal for registration, login, and 1-click demo login (`farmer@poultry.local`), with token storage and automatic authorization headers.
- **User-Specific Poultry Houses:** Dropdown selector and management for houses owned by the logged-in user.
- **Dashboard Overview:** Live summary cards displaying Current Birds, Mortality percentage, Total Feed Consumed (kg), Eggs Collected, Cataloged Breeds, and an active Harvest Alert Banner.
- **Tabbed Interface:**
  - 📅 **Daily Production Records:** Record daily mortality, feed (kg), and egg collection.
  - 🐓 **Bird Breeds:** Manage and view multiple breeds kept per poultry house with flock numbers.
  - 🩺 **Flock Health & Condition:** Health metrics banner and logging for healthy, sick, weak, and observation birds with capacity enforcement.
  - 🔪 **Slaughter Planning:** Harvest calendar with dynamic status badges (`Upcoming`, `Due soon`, `Due today`, `Overdue`, `Completed`), and one-click harvest completion toggle.
- **Data Protection:** Reusable confirmation dialogs protecting destructive actions (deleting houses, records, breeds, health logs, or slaughter plans).
- **Responsive Layout:** Optimized for mobile, tablet, and desktop screens.

## Project Structure

```text
frontend/
|-- src/
|   |-- components/
|   |   |-- AuthModal.jsx             # User sign-in, registration, and demo account
|   |   |-- BirdConditionForm.jsx     # Clinical health check creation & edit form
|   |   |-- BreedForm.jsx             # Bird breed cataloging form
|   |   |-- ConfirmDialog.jsx         # Generic confirmation modal for deletions
|   |   |-- DailyRecordEditForm.jsx   # Daily record modification form
|   |   |-- DailyRecordForm.jsx       # Daily record entry form
|   |   |-- HouseEditForm.jsx         # Poultry house rename / capacity update form
|   |   |-- HouseForm.jsx             # Poultry house creation form
|   |   `-- SlaughterPlanForm.jsx     # Slaughter batch scheduling form
|   |-- services/
|   |   `-- api.js                    # Fetch wrapper with JWT headers and API methods
|   |-- App.css                       # Application stylesheet with modern design system
|   |-- App.jsx                       # Main application state and tabbed dashboard
|   |-- index.css                     # Global base styles
|   `-- main.jsx                      # Application entry point
|-- eslint.config.js                  # ESLint configuration
|-- index.html                        # HTML template
|-- package.json
|-- vite.config.js                    # Vite configuration
`-- README.md
```

## Environment Configuration

Configure `frontend/.env` (or environment variables in your deployment):

```env
VITE_API_URL=http://localhost:5000/api
```

If not provided, the client defaults to `http://localhost:5000/api`.

## Available Scripts

Run from the `frontend/` directory:

```bash
# Install dependencies
npm install

# Start local development server (with HMR)
npm run dev

# Run ESLint validation
npm run lint

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```

## Deployment (Vercel / Netlify / Cloudflare Pages)

- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_URL` pointing to your deployed backend API URL.
