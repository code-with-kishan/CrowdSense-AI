# CrowdSense AI

CrowdSense AI is a lightweight demo for improving the physical event experience at a large-scale sporting venue.

## Chosen Vertical

The chosen vertical is **stadium crowd management and fan navigation**.

That vertical fits the problem well because large venues have the same recurring pain points:
- entry gate congestion
- long queue times for food and restrooms
- poor wayfinding for first-time visitors
- delayed reaction to crowd pressure

This project focuses on helping fans make faster decisions inside the venue with a compact, visually clear dashboard.

## Approach And Logic

The solution is built as a **single-page React dashboard** backed by a small Node.js/Express server.

The design choices are intentionally lightweight:
- A custom SVG stadium map instead of Google Maps or any heavy map SDK
- Small static data files for zones, nodes, and paths
- Rule-based logic for route scoring and recommendations
- Optional Google Gemini and Firebase integration that falls back safely when credentials are unavailable

The logic behind the recommendations is simple and explainable:
- crowd values are normalized into low, medium, and high states
- gates are scored using crowd, wait time, and walking distance
- routes are computed on a small weighted graph
- the assistant answers common venue questions using live crowd and queue context

## How The Solution Works

The UI is organized as a venue operations dashboard.

1. The backend initializes crowd and queue simulation state.
2. The React app renders a dashboard with a decision panel, queue view, assistant panel, and the final stadium map.
3. Crowd values update on a timer so the interface feels live without needing external sensors.
4. The map updates the user marker and route path as the simulated position changes.
5. Clicking a gate, food stall, restroom, or path opens a contextual popup with crowd and wait information.
6. The assistant can respond to common venue questions such as the best gate, nearest food, or nearest restroom.
7. If Google Gemini or Firebase are configured, the system can use them; otherwise it uses the built-in simulation and fallback logic.

## Assumptions Made

- The demo is for a stadium or sports arena, not a general city map.
- Real-time crowd data is simulated locally unless external services are connected.
- The venue layout can be represented accurately enough with a small SVG and a weighted graph.
- Google services may not be configured in every environment, so the app must remain useful without them.
- The primary goal is a judge-ready offline demo that stays under the repository size limit and loads quickly.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Optional services: Google Gemini, Firebase

## Key Files

- [server.js](server.js) - Express server and frontend serving logic
- [client/src/App.jsx](client/src/App.jsx) - Main dashboard and map UI
- [client/src/data/stadiumData.js](client/src/data/stadiumData.js) - Stadium zones, nodes, edges, and movement track
- [client/src/data/navigation.js](client/src/data/navigation.js) - Routing and recommendation helpers
- [services/assistantService.js](services/assistantService.js) - Gemini-powered assistant with fallback logic
- [services/routingService.js](services/routingService.js) - Route generation over the venue graph
- [config/firebaseConfig.js](config/firebaseConfig.js) - Firebase adapter with in-memory fallback

## Run Locally

Backend:

```bash
npm install
npm start
```

Frontend build check:

```bash
cd client
npm install
npm run build
```

If you want the React app during local development:

```bash
cd client
npm run dev
```

## Testing

Run the integration tests from the repository root:

```bash
npm test
```

For the client, the `npm test` script runs a production build as a smoke test.

## Size Discipline

The repository is kept small by design:
- no committed `node_modules`
- no large media assets
- no heavyweight mapping libraries
- SVG-based rendering instead of external map tiles

Check size locally with:

```bash
du -sh .
git count-objects -vH
```

## Notes

This demo is designed to be understandable, fast to load, and easy to extend into a real venue product if live data sources are added later.
