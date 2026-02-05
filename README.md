# Templetor V5

**Democratizing High-Precision Granite Templating**

Replace $20K laser systems with AI-powered smartphone templating for small to medium granite shops.

---

## Quick Start for Developers

**🚀 New to the project?** Read `HANDOVER.md` first (5-minute overview of current status)

### Current Status (Feb 2, 2026)
- **Phase 1: Foundation** - 85% Complete
- **Firebase**: Fully configured (project `tempsbyus`, Firestore + Auth enabled)
- **Web**: Next.js scaffolded (needs deps installed)
- **Mobile**: Expo scaffolded (needs camera deps)
- **Architecture**: Zero-cost MVP (local storage only)

### Next Tasks
1. Install web dependencies (`cd src/web && npm install`)
2. Install mobile dependencies (`cd src/mobile && npx expo install expo-camera`)
3. Implement camera recording with local storage

See `directives/TASKS.md` for full task list and agent assignments.

---

## Project Overview

Templetor V5 uses computer vision to turn smartphone videos into precise countertop measurements:

1. **Field rep records video** of countertop with calibration stick
2. **AI extracts frames** and identifies edges + reference object
3. **Calculates real dimensions** from pixel measurements
4. **Manager reviews** measurements and 2D blueprint in web dashboard
5. **CNC-ready template** generated (post-MVP)

**Cost**: $0/month for MVP (Firebase Spark + Gemini free tier)

---

## Architecture

```
Mobile Device (Phone)
├── Records video → LOCAL STORAGE (FileSystem.cacheDirectory)
├── Extracts 10 frames locally
├── Sends frames to Gemini Vision API
└── Saves results to Firestore (measurements, 2D blueprint)

Web Dashboard (Next.js)
├── Reads job data from Firestore
├── Displays measurements + 2D visualization
└── Allows approval/editing
```

**Key Constraint**: NO cloud video storage (stays free tier)

---

## Project Structure

```
Templetor_V5/
├── src/
│   ├── mobile/          # Expo React Native app
│   │   ├── app/         # expo-router screens
│   │   ├── components/  # React components
│   │   └── lib/         # Utilities, Firebase config
│   └── web/             # Next.js 14 dashboard
│       ├── app/         # App Router pages
│       ├── components/  # React components
│       └── lib/         # Utilities, Firebase config
├── directives/          # Project governance
│   ├── TASKS.md         # Current task status & assignments
│   ├── SOP.md           # Standard operating procedures
│   ├── ROADMAP.md       # Project phases & timeline
│   ├── NORTH_STAR.md    # Vision & success criteria
│   ├── TASK_BREAKING.md # Task decomposition protocol
│   └── PFD.md           # Product requirements
├── agents/              # Agent persona definitions
│   ├── mobile-developer.md
│   ├── frontend-specialist.md
│   ├── integration-expert.md
│   └── ...
├── skills/              # Agent skill libraries
│   ├── mobile-design/
│   ├── nextjs-best-practices/
│   ├── react-patterns/
│   └── ...
├── knowledge-base/      # Lessons learned
│   └── LEARNED_SOLUTIONS.md
├── docs/                # Technical documentation
├── tests/               # Test suites
└── scripts/             # Utility scripts
```

---

## Agent-Driven Development

This project uses specialized agents for different tasks:

| Agent | Tasks | Skills Required |
|-------|-------|-----------------|
| **Mobile Developer** | Camera, local storage, frame extraction | `mobile-design`, `react-patterns` |
| **Frontend Specialist** | Web dashboard, 2D visualization | `nextjs-best-practices`, `tailwind-patterns` |
| **Integration Expert** | Firebase, Gemini API | `integration-expert`, `database-design` |
| **Backend Specialist** | Calculations, data processing | `nodejs-best-practices` |

**Workflow:**
1. Read `directives/TASKS.md` for next task
2. Load required skills from `skills/` folder
3. Implement following skill guidelines
4. Update `TASKS.md` status
5. Report completion

See `directives/SOP.md` for complete workflow.

---

## Technology Stack

- **Mobile**: Expo (React Native) + TypeScript
- **Web**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth)
- **AI**: Gemini Pro Vision API
- **Storage**: Device local cache (NO cloud for MVP)

---

## Firebase Configuration

Project: `tempsbyus`
- **Firestore**: Enabled (Normal mode, us-central)
- **Auth**: Email/Password enabled
- **Storage**: Not used (MVP uses local device storage)

Environment files:
- `src/web/.env.local` - Web Firebase config
- `src/mobile/.env` - Mobile Firebase config

---

## Key Documents

### Start Here
- **`HANDOVER.md`** - Current status & next steps (READ THIS FIRST)
- **`directives/TASKS.md`** - All 18 tasks with agent assignments

### For Developers
- **`directives/SOP.md`** - Development workflow & agent assignments
- **`agents/[your-agent].md`** - Your specific agent definition
- **`skills/[skill-name]/SKILL.md`** - Required skills for your tasks

### For Project Understanding
- **`directives/NORTH_STAR.md`** - Vision & success criteria
- **`directives/ROADMAP.md`** - Project phases & timeline
- **`directives/PFD.md`** - Product requirements

---

## Development Commands

### Web Dashboard
```bash
cd src/web
npm install
npm run build    # Verify build passes
npm run dev      # Start dev server
```

### Mobile App
```bash
cd src/mobile
npx expo install expo-camera expo-video-thumbnails
npx expo start   # Start Expo Go
```

---

## Cost Breakdown (MVP)

| Service | Cost | Notes |
|---------|------|-------|
| Firebase Spark | $0 | 50K reads/day, 20K writes/day |
| Gemini Vision API | $0 | 60 requests/min free tier |
| Cloud Storage | $0 | Not used (local device only) |
| **Total** | **$0/month** | For 1-2 demo examples |

---

## Important Notes

- **NO Firebase Storage**: Videos stay on device to remain free tier
- **Skills Loading MANDATORY**: Read all required SKILL.md files before coding
- **Build Verification Required**: Must run builds before marking complete
- **Update TASKS.md**: Always update status when starting/completing tasks

---

## Last Updated

February 2, 2026

**Current Phase:** 1 (Foundation) - 85% Complete  
**Next Priority:** Complete web & mobile scaffolding, then camera implementation
