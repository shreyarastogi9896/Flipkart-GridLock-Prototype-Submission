# TrafficIQ – Predict. Prevent. Redirect.

TrafficIQ is an AI-powered traffic intelligence and diversion management platform that helps authorities proactively manage planned and unplanned traffic disruptions. By combining Generative AI, Machine Learning, and graph-based routing, the system analyzes incidents, predicts traffic impact, assists police decision-making, and generates intelligent diversion routes in real time.

## Features

* AI-powered traffic incident analysis
* Traffic impact and road closure prediction
* Police approval and decision support dashboard
* Smart diversion route generation
* Live active incident monitoring
* Continuous learning from historical traffic data

## Technology Stack

**Frontend:** React.js, Tailwind CSS, Leaflet Maps

**Backend:** FastAPI, Python

**Database:** MongoDB

**AI & ML:** Google Gemini API, Pandas, Scikit-Learn

**Routing:** OpenStreetMap, OSMnx, NetworkX

**Deployment:** Vercel, Render

## Environment Setup

Copy the sample environment file:

```bash
cp .env.example .env
```

Windows:

```bash
copy .env.example .env
```

Update the values inside `.env` with your own configuration.

## Running the Project

### Backend

Install dependencies and start the FastAPI server:

```bash
pip install -r requirements.txt
python -m uvicorn app:app --reload
```

Backend API:

```text
http://localhost:8000
```

### Frontend

Install dependencies and start the React application:

```bash
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Workflow

1. User reports a traffic incident.
2. AI extracts event intelligence from the description.
3. ML models predict severity, impact, and road closure probability.
4. Police officers review AI recommendations and approve final actions.
5. Approved incidents become active traffic events.
6. Smart diversion routes are generated around blocked roads.
7. Incident data is stored for continuous learning and future forecasting.


