import type { Response } from "express";

// ---------------------------------------------------------------------------
// In-process real-time event bus (Server-Sent Events).
//
// Each authenticated user gets a streaming /api/events connection; mutations
// broadcast a small event (resource type) that the client uses to invalidate
// its TanStack Query caches, so the UI updates in all open tabs immediately.
//
// NOTE: in-memory by design — works for the single-instance deployments this
// project targets. For multi-instance scale replace with a Redis pub/sub.
// ---------------------------------------------------------------------------

export type LiveEvent = { type: string; payload?: Record<string, unknown> };

const POOL: Array<{ userId: string; res: Response }> = [];
const HEARTBEAT_MS = 25_000;

function send(res: Response, chunk: string) {
  res.write(chunk);
}

export function subscribeLive(userId: string, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  send(res, `: connected\n\n`);

  const heartbeat = setInterval(() => {
    send(res, `: ping\n\n`);
  }, HEARTBEAT_MS);

  POOL.push({ userId, res });
  const self = { userId, res };
  let closed = false;

  res.on("close", () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    const index = POOL.indexOf(self);
    if (index >= 0) POOL.splice(index, 1);
  });
  res.on("error", () => res.destroy()); 
}

/** Broadcast an event to every live connection for the given user. */
export function publishLive(userId: string, event: LiveEvent): void {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event.payload ?? {})}\n\n`;
  for (const conn of POOL) {
    if (conn.userId === userId) {
      try {
        send(conn.res, frame);
      } catch {
        /* connection is gone; cleanup happens on close */
      }
    }
  }
}

/** Convenience wrapper for the common "resource changed" event. */
export function broadcastResource(userId: string, resource: string): void {
  publishLive(userId, { type: resource, payload: { resource } });
}