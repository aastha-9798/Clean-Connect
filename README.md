# **CleanConnect**
A community platform for reporting waste problems and organising cleanup drives.

## Project Overview
Improper waste disposal is one of the most pressing environmental and public health challenges faced by urban and semi-urban areas today. Waste problems often go unreported, or reported cases lack sufficient evidence and location accuracy. Additionally, community participation in cleanliness drives is limited due to poor awareness and coordination. Improper waste management has a direct impact on environmental sustainability, public health, and the quality of life. Uncollected and unsegregated waste leads to air, water, and soil pollution, increases the spread of diseases, and contributes to climate change through greenhouse gas emissions.

## Approach
CleanConnect is a web application with a client–server architecture: an Angular single-page frontend talks to a FastAPI REST backend.

- **Authentication** – Users sign up and log in with email and password. Passwords are hashed with Argon2. On login the API returns a short-lived JWT access token (15 minutes) and a refresh token (7 days); the frontend refreshes the access token automatically when it expires.
- **Report an Issue** – Users upload 1 to 5 photos of a waste problem (up to 5 MB each) along with its exact location and a description. The location can come from the browser and is fine-tuned by dragging a pin on a map (or by tapping the map). The first photo is the cover shown on cards; the rest appear in a gallery in the report details.
- **Map** – A map page shows planned drives and open reports in the visible area (and recently cleaned spots when ticked), with a "Nearby" list sorted by distance from the user. Pins open the same report and drive details as the feed.
- **Community Feed** – The home page shows active cleanup drives, open reports that don't have a drive yet, and recently cleaned spots with before/after photos.
- **Cleanup Drives** – Any user can organise a drive for an open report by setting a date and description. Other users can join or leave the drive; the organiser is always a participant.
- **On the day of a drive** – From 30 minutes before the start until 6 hours after, attendees check in from the drive dialog; the browser's location must be within 200 m of the spot (it is only used for the check-in and never stored). People who never pressed "Join" can check in too and are added automatically. Checked-in attendees can add up to 2 "after" photos each (10 per drive). The organiser sees who checked in and can remove a check-in that looks wrong.
- **Completing a drive** – Once the drive has started and has at least one "after" photo, the organiser marks it completed: the report becomes *resolved* and the spot appears under "Recently cleaned". A drive that isn't completed within 2 days of its start is cancelled automatically — it leaves the feed (it stays visible in participants' profiles) and its report becomes open again.
- **Report status** – *pending* (no drive) → *in progress* (a drive is planned) → *resolved* (the drive was completed).
- **Deleting** – Reporters can delete their own reports (only while no drive is attached), and organisers can delete their own drives while they are still planned; the report then shows as open again.
- **Profile** – Users can see the reports they've raised and the drives they're part of.
- **AI Assistant** – A chatbot powered by Google Gemini answers waste-management questions and can respond to an uploaded image. Replies stream in as they are written, and each user's chat history is saved.

## Tech Stack
- **Frontend:** Angular 19 (standalone components), TypeScript, Angular Material, Bootstrap 5, Leaflet with OpenStreetMap tiles
- **Backend:** Python, FastAPI, Uvicorn
- **Database:** SQLite via SQLAlchemy 2 ORM
- **Authentication:** JWT (python-jose), Argon2 password hashing (passlib)
- **AI:** Google Gemini (`google-genai` SDK), Pillow for image handling
- **Storage:** Uploaded images are stored on the server's local disk in `uploads/` and served at `/uploads`

## Project Structure
```
backend/
  main.py             FastAPI app, CORS, router registration, /uploads static mount
  database.py         SQLAlchemy engine and session (SQLite)
  authentication/     signup, login, token refresh, current-user dependency
  reports/            report upload
  drives/             create / join / leave drives, community feed
  user/               the current user's reports and drives
  ai/                 Gemini chatbot and chat history
frontend/
  src/app/core/       services, models, auth guard, auth interceptor
  src/app/pages/      feed, login, signup, report, profile, chat
  src/app/shared/     navbar, report dialog, drive dialog
```

## API Overview
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | – | Create an account |
| POST | `/auth/login` | – | Get access and refresh tokens |
| POST | `/auth/refresh` | Refresh token | Get a new access token |
| GET | `/auth/me` | ✔ | Current user's details |
| POST | `/reports/upload` | ✔ | Upload a report (multipart: 1–5 `images`, latitude, longitude, description) |
| DELETE | `/reports/{report_id}` | ✔ | Delete your own report (not allowed while it has a drive) |
| GET | `/drives/feed` | – | Active drives, completed drives and open reports |
| POST | `/drives/` | ✔ | Create a drive for a report |
| POST | `/drives/{drive_id}/join` | ✔ | Join a drive |
| DELETE | `/drives/{drive_id}/leave` | ✔ | Leave a drive |
| DELETE | `/drives/{drive_id}` | ✔ | Delete your own drive (planned drives only) |
| GET | `/drives/{drive_id}/me` | ✔ | Your state on a drive (joined, checked in, photos added) |
| POST | `/drives/{drive_id}/check-in` | ✔ | Check in with your current location (latitude, longitude, accuracy) |
| POST | `/drives/{drive_id}/photos` | ✔ | Add "after" photos (multipart `images`; checked-in attendees only) |
| POST | `/drives/{drive_id}/complete` | ✔ | Mark your drive as completed (organiser only) |
| GET | `/drives/{drive_id}/attendees` | ✔ | Who joined and who checked in (organiser only) |
| DELETE | `/drives/{drive_id}/check-in/{user_id}` | ✔ | Remove a check-in and that person's photos (organiser only) |
| GET | `/user/me/reports` | ✔ | Reports raised by the current user |
| GET | `/user/me/drives` | ✔ | Drives the current user participates in |
| GET | `/map/items` | – | Planned drives and open reports inside a map area (`min_lat`, `max_lat`, `min_lng`, `max_lng`; `include_cleaned=true` adds completed drives) |
| POST | `/ai/chat` | ✔ | Send a message (and optional image); the reply streams back as one JSON event per line (`chunk`, `done` or `error`) |
| GET | `/ai/history` | ✔ | The current user's chat history |

Interactive API docs are available at `http://127.0.0.1:8000/docs` while the backend is running.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18.19+ and npm
- A Google Gemini API key

### Backend
1. Create a `.env` file in the repository root:
   ```
   SECRET_KEY=<a long random string used to sign JWTs>
   GOOGLE_API_KEY=<your Gemini API key>
   ```
2. Create a virtual environment and install dependencies (from the repository root):
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
   On macOS/Linux, activate with `source venv/bin/activate`.
3. Start the server **from the repository root** (the database and `uploads/` paths are relative to it):
   ```bash
   uvicorn backend.main:app --reload
   ```
   The API runs at `http://127.0.0.1:8000`. The SQLite database (`backend/cleanconnect.db`) and its tables are created automatically on first run.

### Frontend
```bash
cd frontend
npm install
npm start
```
The app runs at `http://localhost:4200`. The backend URL is set in `frontend/src/environments/environment.ts`.

## Roadmap
- Waste image classification (dry vs wet waste)
- Tagging local authorities on reports
- Notifications for drive updates
- AI check that compares a drive's before and after photos
