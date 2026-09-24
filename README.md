# Agent World

An isometric, voxel-style 3D office where AI agents work in teams. Built with **Three.js + React Three Fiber**.

- **Every team is an office room.** Creating a team builds a new room, which animates into place, spiralling out from the centre of the office.
- **Every agent is a worker.** Hiring an agent drops a new voxel worker onto a fresh desk in their team's room.
- **Workers are animated.** They type at their desks, think (thought bubbles), upload results to the brain, walk to the whiteboard for meetings, and take coffee breaks in the lounge.
- **Every room is wired to the Central Brain.** Each room has a comms tower whose glowing cable plugs into the brain's input ring, and a light strip runs along the walkway floor. When a worker syncs, the data visibly travels desk → tower → cable → brain; cyan "knowledge" flows back the other way.
- **The brain is alive.** A holographic voxel brain floats on a projector beam: neurons flicker, thoughts sweep across it, and the side facing an incoming upload lights up with a shockwave. The latest memories orbit it as cubes in the colour of the team that wrote them.

```
┌──────────────────────────── browser (client/) ────────────────────────────┐
│  React Three Fiber scene           HUD (React)                            │
│  ├─ Brain (server room + core)     ├─ Teams panel / activity feed         │
│  ├─ Room × N  ── Character × M     ├─ Inspector (agent / team / brain)    │
│  └─ Links + Packets                └─ Create team / Hire agent modals     │
│                 ▲ zustand store (live mirror of the brain)                │
└─────────────────┼─────────────────────────────────────────────────────────┘
          REST /api/*  +  WebSocket /ws (every change is pushed live)
┌─────────────────┼──────────────── brain (server/) ────────────────────────┐
│  Brain: project, teams, agents, memory  →  server/data/brain.json         │
│  Simulation: drives "autopilot" agents through their work loop            │
└───────────────────────────────────────────────────────────────────────────┘
```

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # brain on :8787, office on http://localhost:5173
```

On first launch the brain seeds a demo project with four teams. Delete `server/data/brain.json` to start over.

Production build (the brain serves the built office on one port):

```bash
npm run build
npm start          # http://localhost:8787
```

### Standalone demo (no server)

```bash
npm run build:demo   # → client/dist-demo/agent-world.html
```

The demo build runs the brain and its simulation inside the page, so the single HTML file works on its own. Nothing is saved: reloading starts over.

| Env var       | Default                  | Purpose                                   |
| ------------- | ------------------------ | ----------------------------------------- |
| `PORT`        | `8787`                   | Brain HTTP/WebSocket port                 |
| `BRAIN_FILE`  | `server/data/brain.json` | Where the brain persists its data         |
| `SIMULATE`    | `true`                   | Set to `false` to turn off the simulation |
| `BRAIN_URL`   | `http://localhost:8787`  | Brain address the Vite dev proxy targets  |

## Controls

A first-time visitor sees a short welcome card (reopen it with **?**). Everything can be done with the camera bar at the bottom of the screen:

| Button            | Shortcut   | What it does                                                   |
| ----------------- | ---------- | -------------------------------------------------------------- |
| Fit all           | `F`        | Show the whole office                                          |
| ↺ / ↻             | `Q` / `E`  | Rotate 90°; walls that would block the view drop out of the way |
| − / +             | `-` / `+`  | Zoom out / in                                                  |
| Classic, Top, Low | `1` `2` `3` | Isometric, straight-down and eye-level viewing angles          |
| Tour              | `T`        | The camera visits the brain and each room in turn              |

With a mouse: drag to pan, right-drag to rotate, scroll to zoom. Click a worker, a room or the brain to inspect it; `Esc` closes the panel.

## Connecting real AI agents

Agents are simulated by default (**autopilot**). To drive an agent from a real LLM agent or any other process, hire it with autopilot off (or turn autopilot off in the inspector), then report to the brain over HTTP. The office animates whatever you send.

```bash
# Change what the worker is doing (working | thinking | syncing | meeting | break)
curl -X PATCH localhost:8787/api/agents/$AGENT_ID \
  -H 'content-type: application/json' \
  -d '{"status":"working","currentTask":"Draft the Q3 plan"}'

# Store a result in the shared brain (kind: artifact | insight | decision | note)
curl -X POST localhost:8787/api/memory \
  -H 'content-type: application/json' \
  -d '{"agentId":"'$AGENT_ID'","kind":"insight","content":"Churn is concentrated in week one"}'

# Read the shared memory back, e.g. as context for the next LLM call
curl 'localhost:8787/api/memory?teamId=$TEAM_ID&q=churn&limit=20'
```

### API

| Method   | Path              | Body / query                                                    |
| -------- | ----------------- | --------------------------------------------------------------- |
| `GET`    | `/api/state`      | Full snapshot: project, teams, agents, recent memory, stats     |
| `PATCH`  | `/api/project`    | `{ name?, description?, goal? }`                                |
| `GET`    | `/api/teams`      |                                                                 |
| `POST`   | `/api/teams`      | `{ name, description?, color?, icon? }` → builds a new room      |
| `DELETE` | `/api/teams/:id`  | Closes the room and removes its agents                          |
| `GET`    | `/api/agents`     |                                                                 |
| `POST`   | `/api/agents`     | `{ name, role, teamId, appearance?, autopilot? }` → new worker   |
| `GET`    | `/api/agents/:id` |                                                                 |
| `PATCH`  | `/api/agents/:id` | `{ status?, currentTask?, autopilot?, name?, role? }`           |
| `DELETE` | `/api/agents/:id` |                                                                 |
| `GET`    | `/api/memory`     | `?teamId=&agentId=&q=&limit=`                                   |
| `POST`   | `/api/memory`     | `{ content, kind?, agentId?, teamId? }`                         |
| `WS`     | `/ws`             | Sends a `snapshot`, then one event per change (see `shared/types.ts`) |

Each room has 12 desks; create more teams to grow the office.

## Project layout

```
shared/
  types.ts         Domain types shared by server and client
  catalog.ts       Roles, colours, names and appearance options
  brain.ts         Brain core: state, validation, change events (runs in Node or the browser)
  simulation.ts    Work loop for autopilot agents (work → think → sync → meet → break)
server/src/
  brain.ts         Brain core plus JSON-file persistence
  index.ts         Express REST API + WebSocket broadcast
client/src/
  lib/store.ts     Live zustand mirror of the brain + UI state
  lib/demo.ts      In-page brain used by the standalone demo build
  scene/
    Office.tsx     Canvas, isometric orthographic camera, lights, bloom
    Brain.tsx      Central server room: glass walls, racks, DB stacks
    BrainCore.tsx  Brain hologram, projector beam, input ring, memory shards, shockwaves
    Room.tsx       Team room, lounge, whiteboard, workstations
    Character.tsx  Worker controller: sit/stand/walk state machine and poses
    VoxelPerson.tsx  Voxel body built from an appearance, with animation rig
    Links.tsx      Room towers, cables and floor light strips; upload packets
    shaders.ts     Flowing-light and hologram-beam materials
    voxels.ts      Merged vertex-coloured box builder (one draw call per room)
    layout.ts      Floor plan: room slots, desks, meeting and lounge spots
  ui/              HUD, inspector and modals
```
