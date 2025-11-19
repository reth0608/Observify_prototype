// Observify client SDK - bundled minimal ES module
export class Tracker {
  constructor(apiKey, endpoint, sampleRate = 1) {
    this.apiKey = apiKey || "demo_key";
    this.endpoint = endpoint || "/ingest";
    this.sampleRate = sampleRate;
    this.buffer = [];
    this.flushInterval = 3000;
    this.timer = null;
    this.sessionId = Math.random().toString(36).slice(2,9);
  }

  start() {
    // error handlers
    window.addEventListener("error", e => {
      this.queue({ type: "error", message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: e.error && e.error.stack, url: location.href, ts: Date.now(), sessionId: this.sessionId });
    });
    window.addEventListener("unhandledrejection", ev => {
      const reason = ev.reason || "unhandledrejection";
      this.queue({ type: "rejection", message: String(reason), stack: reason && reason.stack, url: location.href, ts: Date.now(), sessionId: this.sessionId });
    });
    // wrap fetch
    if (window.fetch) {
      const orig = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const start = performance.now();
        try {
          const res = await orig(...args);
          const dur = Math.round(performance.now() - start);
          this.queue({ type: "network", url: (typeof args[0] === "string" ? args[0] : args[0].url), status: res.status, duration: dur, ts: Date.now(), sessionId: this.sessionId });
          return res;
        } catch (err) {
          const dur = Math.round(performance.now() - start);
          this.queue({ type: "network-error", url: (typeof args[0] === "string" ? args[0] : args[0].url), message: String(err), duration: dur, ts: Date.now(), sessionId: this.sessionId });
          throw err;
        }
      };
    }
    // performance snapshot on load
    window.addEventListener("load", () => {
      try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) {
          this.queue({ type: "performance", loadTime: Math.round(nav.loadEventEnd - nav.startTime), url: location.href, ts: Date.now(), sessionId: this.sessionId });
        }
      } catch(e){}
    });

    this.timer = setInterval(() => this.flush(), this.flushInterval);
    this.queue({ type: "init", url: location.href, ua: navigator.userAgent, ts: Date.now(), sessionId: this.sessionId });
  }

  queue(ev) {
    if (Math.random() > this.sampleRate) return;
    this.buffer.push(ev);
    if (this.buffer.length >= 8) this.flush();
  }

  async flush() {
    if (!this.buffer.length) return;
    const payload = { apiKey: this.apiKey, events: this.buffer.splice(0, this.buffer.length), ts: Date.now() };
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, body);
      } else {
        await fetch(this.endpoint, { method: "POST", headers: {"Content-Type":"application/json"}, body });
      }
    } catch(err){
      console.warn("Observify flush failed", err);
    }
  }
}

if (typeof window !== 'undefined') {
  window.Observify = window.Observify || {};
  window.Observify.Tracker = Tracker;
}
