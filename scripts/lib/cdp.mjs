// Minimal request/response CDP transport; every request has a bounded lifetime.
export async function connectCDP(url, timeoutMs = 5000) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  const rejectAll = (message) => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
    pending.clear();
  };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`CDP: ${message.error.message}`));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => rejectAll('Chrome disconnected from CDP'));
  socket.addEventListener('error', () => rejectAll('CDP WebSocket error'));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timeout')); }, timeoutMs);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Cannot connect to Chrome CDP')); }, { once: true });
  });
  return {
    send(method, params = {}) {
      if (socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP is closed'));
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { rejectAll('CDP closed'); socket.close(); },
  };
}
