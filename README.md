<h1 align="center">🏟️ CrowdSense AI</h1>
<p align="center">
  <strong>AI-powered real-time crowd management, navigation & safety for stadium environments</strong>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Powered%20by-Google%20Gemini-4285F4?style=for-the-badge&logo=google"/>
  <img src="https://img.shields.io/badge/Firebase-Firestore-FF6F00?style=for-the-badge&logo=firebase"/>
  <img src="https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4?style=for-the-badge&logo=googlecloud"/>
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs"/>
</p>

---

## 🎯 Problem

Every major stadium event faces the same critical challenges:
- **Crowd congestion** at entry gates causing dangerous bottlenecks
- **Long, unpredictable wait times** at food courts and restrooms  
- **Poor real-time navigation** for fans unfamiliar with the venue
- **Slow emergency response** due to lack of intelligent crowd awareness
- **No unified intelligence layer** connecting crowd data, routing, and communication

## 💡 Solution

The **CrowdSense AI** platform is a production-grade AI system that:

1. **Continuously monitors** crowd density across all stadium zones
2. **Scores each location** using a multi-factor intelligence engine
3. **Routes fans dynamically** to the least congested gates, food courts, and exits
4. **Understands natural language** via Google Gemini — answering any stadium query conversationally
5. **Pushes real-time alerts** when congestion becomes critical
6. **Adapts to match phases** automatically (pre-match surge, half-time rush, post-match exodus)

---

## 🧠 Intelligence Engine

The core decision formula:

```
score = (crowd_density × 0.5) + (queue_time × 0.3) + (peak_factor × 0.2)
```

| Factor | Weight | Source |
|---|---|---|
| Crowd Density | 50% | Real-time simulation engine |
| Queue Wait Time | 30% | Throughput model (people/min) |
| Peak Factor | 20% | Time-of-day + match phase |

Lower score = better option for the fan.

### Match Phase Awareness

| Phase | Gate | Food | Restroom |
|---|---|---|---|
| 🚪 Gates Open | 1.5× surge | 0.8× | 0.6× |
| ⚽ Pre-Match | 2.0× | 1.2× | 0.8× |
| ⏸️ Half-Time | 0.2× | **2.5×** | **2.0×** |
| 🏁 Post-Match | **2.5×** | 0.5× | 1.5× |

---

## 🚀 Features

### 1. 🗺️ Smart Navigation
- Dijkstra shortest-path routing over the stadium graph
- Recommends least-congested gate with step-by-step directions
- 3 alternate gate suggestions ranked by score
- Swappable with Google Maps Directions API in production

### 2. ⏱️ Queue Prediction
- Real-time wait time calculation per zone type
- Future wait projection based on match phase trend
- Throughput model: gates (300/min), food (50/min), restrooms (120/min)

### 3. 🤖 Context-Aware AI Assistant
- **Google Gemini** for natural language understanding (with graceful fallback)
- Intent classification: NAVIGATION, FOOD, CROWD, EMERGENCY, EXIT, RESTROOM
- Multi-turn conversation history (per session)
- Responses enriched with live stadium data

### 4. 🚨 Real-Time Alerts
- Automatic alert generation when zones go CRITICAL (score > 0.75)
- Emergency exit routing with Dijkstra pathfinding
- Voice input (Web Speech API) for hands-free queries

### 5. 🎛️ Facility Optimization
- Ranked food courts by (wait time + travel time)
- Nearest restroom recommendation
- Exit strategy with predicted wait times

---

## 🏗️ Architecture

```
crowdsense-ai/
├── server.js                  # Express server (Cloud Run ready)
├── config/
│   └── firebaseConfig.js      # Firebase + in-memory fallback
├── services/
│   ├── crowdService.js        # Stateful simulation engine ★
│   ├── queueService.js        # Wait time prediction
│   ├── routingService.js      # Dijkstra pathfinding (→ Maps API)
│   └── assistantService.js    # Gemini AI + rule-based fallback
├── utils/
│   ├── decisionEngine.js      # Core scoring formula ★
│   └── contextAnalyzer.js     # NLP intent classifier
├── api/
│   └── routes.js              # RESTful API endpoints
├── client/
│   └── src/                   # React dashboard, map, queue, assistant panels
├── public/
│   ├── index.html             # Legacy static fallback UI
│   ├── css/style.css          # Premium dark design system
│   └── js/app.js              # Real-time frontend engine
├── tests/
│   └── api.test.js            # 30+ integration tests
└── Dockerfile                 # Cloud Run optimized
```

### Google Services Integration

| Service | Role | Status |
|---|---|---|
| **Gemini API** | Natural language chat engine | ✅ Real API (with fallback) |
| **Firebase Firestore** | Real-time state persistence | ✅ Real API (with in-memory fallback) |
| **Google Maps API** | Routing (Dijkstra simulation) | 🔄 Swappable in `routingService.js` |

---

## 🎬 Demo Flow — User Journey

```
1. 🚗 USER ARRIVES AT STADIUM
   → System detects pre-match phase, gate surge beginning

2. 📱 "Which gate should I enter from?"
   → AI: "Gate 2 (South) is currently least congested at 28% full
          with only a 4-minute wait. I recommend entering from there
          to avoid delays. Gate 5 is a good VIP alternative."
   → Route panel: Step-by-step directions from parking

3. ✅ USER AVOIDS CROWDED GATE 1 (72% full, 22-min wait)

4. 🍔 "I'm hungry, where can I find food quickly?"
   → AI: "Food Court C in the South Wing has the shortest queue
          right now — about 8 minutes. It's a 2-minute walk from
          your current section. Head to the South Concourse."
   → Score breakdown shows decision factors

5. ⚠️ HALF-TIME — System detects surge
   → Alert banner: "Food Court A is critically congested. Avoid."
   → AI automatically reroutes to Food Court D (VIP Lounge)

6. 🏁 "How do I get out without the traffic?"
   → AI: "Exit via Gate 4 (West) — currently our least busy gate
          with only a 6-minute wait. Leave now to beat the rush."
   → Exit route displayed with estimated 3-minute travel time
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express 4 |
| AI/NLP | Google Gemini 2.0 Flash |
| Database | Firebase Firestore (in-memory fallback) |
| Routing | Dijkstra algorithm (Google Maps API ready) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Deployment | Docker + Google Cloud Run |
| Testing | Native Node.js (no test framework dependency) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/code-with-kishan/crowdsense-ai.git
cd crowdsense-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys (optional — runs without them using fallbacks)
```

### 3. Run

```bash
# Development
npm run dev

# Production
npm start
```

Open http://localhost:3000

### Frontend build

```bash
cd client
npm install
npm run build
```

The backend serves `client/dist` automatically when the build exists, so the same container can host the React UI on Cloud Run.

### Deployment Link

`<add-your-live-deployment-url-here>`

### 4. Test

```bash
npm test
```

---

## ☁️ Deploy to Google Cloud Run

```bash
# 1. Build Docker image
docker build -t crowdsense-ai .

# 2. Tag for Artifact Registry
docker tag crowdsense-ai \
   gcr.io/YOUR_PROJECT_ID/crowdsense-ai:latest

# 3. Push
docker push gcr.io/YOUR_PROJECT_ID/crowdsense-ai:latest

# 4. Deploy to Cloud Run
gcloud run deploy crowdsense-ai \
   --image gcr.io/YOUR_PROJECT_ID/crowdsense-ai:latest \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,FIREBASE_PROJECT_ID=your_id \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10
```

---

## 🔐 Security

- All credentials via environment variables (never hardcoded)
- Input validation on all API endpoints (type, length, pattern)
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- Non-root Docker user
- CORS restricted to production domain in production mode
- Request body size limit: 10KB

---

## 📊 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | System health check |
| GET | `/api/v1/crowd/summary` | Stadium overview |
| GET | `/api/v1/crowd/alerts` | Active congestion alerts |
| GET | `/api/v1/crowd/zones/:type` | Zones by type (gate/food/restroom/concourse) |
| GET | `/api/v1/queue` | All queue wait times |
| GET | `/api/v1/routing/entry?from=parking_north` | Smart entry route |
| GET | `/api/v1/routing/food?from=concourse_n` | Nearest food courts |
| GET | `/api/v1/routing/exit` | Exit strategy |
| GET | `/api/v1/routing/emergency` | Emergency exits |
| POST | `/api/v1/assistant/chat` | AI chat (body: `{message, sessionId, location}`) |

---

## 📦 Repository Size

Estimated tracked repository size is well under 10 MB because the project excludes `node_modules`, build outputs, logs, and other generated artifacts via `.gitignore`.

---

## 👨‍💻 Author

**Kishan Nishad** — Built with ❤️ for real-world stadium deployment

---

*"Gate 2 is currently the least crowded. I recommend entering from there to avoid delays."*
