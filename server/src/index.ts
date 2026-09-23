// HTTP + WebSocket entry point for the central brain.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerEvent } from '../../shared/types.ts';
import { Brain, HttpError } from './brain.ts';
import { startSimulation } from './simulation.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_FILE = process.env.BRAIN_FILE ?? path.resolve(here, '../data/brain.json');
const CLIENT_DIST = path.resolve(here, '../../client/dist');

const brain = new Brain(DATA_FILE);
const app = express();
app.use(express.json({ limit: '256kb' }));

const api = express.Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, clients: wss.clients.size });
});

api.get('/state', (_req, res) => {
  res.json(brain.snapshot());
});

api.patch('/project', (req, res) => {
  res.json(brain.updateProject(req.body ?? {}));
});

api.get('/teams', (_req, res) => {
  res.json(brain.snapshot().teams);
});

api.post('/teams', (req, res) => {
  res.status(201).json(brain.createTeam(req.body ?? {}));
});

api.delete('/teams/:id', (req, res) => {
  brain.deleteTeam(req.params.id);
  res.status(204).end();
});

api.get('/agents', (_req, res) => {
  res.json(brain.agents);
});

api.post('/agents', (req, res) => {
  res.status(201).json(brain.createAgent(req.body ?? {}));
});

api.get('/agents/:id', (req, res) => {
  res.json(brain.agent(req.params.id));
});

api.patch('/agents/:id', (req, res) => {
  const { name, role, status, currentTask, autopilot } = req.body ?? {};
  res.json(brain.updateAgent(req.params.id, { name, role, status, currentTask, autopilot }));
});

api.delete('/agents/:id', (req, res) => {
  brain.deleteAgent(req.params.id);
  res.status(204).end();
});

api.get('/memory', (req, res) => {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  res.json(
    brain.queryMemory({
      teamId: str(req.query.teamId),
      agentId: str(req.query.agentId),
      q: str(req.query.q),
      limit: Math.min(500, Number(req.query.limit) || 100),
    }),
  );
});

api.post('/memory', (req, res) => {
  const { content, kind, agentId, teamId } = req.body ?? {};
  res.status(201).json(brain.remember({ content, kind, agentId, teamId }));
});

app.use('/api', api);

// Serve the built office in production (`npm run build && npm start`).
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  const hello: ServerEvent = { type: 'snapshot', state: brain.snapshot() };
  socket.send(JSON.stringify(hello));
});

brain.on('event', (event) => {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
});

if (process.env.SIMULATE !== 'false') startSimulation(brain);

server.listen(PORT, () => {
  console.log(`[brain] listening on http://localhost:${PORT} (data: ${DATA_FILE})`);
});

function shutdown() {
  brain.flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
