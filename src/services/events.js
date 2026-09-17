const POOL = [];
const HEARTBEAT_MS = 25_000;

function send(res, chunk) {
  res.write(chunk);
}

export function subscribeLive(userId, res) {
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

export function publishLive(userId, event) {
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

export function broadcastResource(userId, resource) {
  publishLive(userId, { type: resource, payload: { resource } });
}
