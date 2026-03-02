const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getSentiment() {
  return fetchJSON("/api/sentiment");
}

export function getRedditSentiment() {
  return fetchJSON("/api/sentiment/reddit");
}

export function getTwitterSentiment() {
  return fetchJSON("/api/sentiment/twitter");
}

export function getMarketData(ticker) {
  return fetchJSON(`/api/market/${ticker}`);
}

export function getNews(ticker) {
  return fetchJSON(`/api/news/${ticker}`);
}

export function generateSignals() {
  return fetch(`${BASE}/api/signals/generate`, { method: "POST" }).then(
    async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      return res.json();
    }
  );
}

export function getLatestSignals(limit = 10) {
  return fetchJSON(`/api/signals/latest?limit=${limit}`);
}

export function getSignalAccuracy() {
  return fetchJSON("/api/signals/accuracy");
}

export function getStockTwitsSentiment() {
  return fetchJSON("/api/sentiment/stocktwits");
}

export function getStockTwitsTicker(ticker) {
  return fetchJSON(`/api/sentiment/stocktwits/${ticker}`);
}

export function getDataSourcesStatus() {
  return fetchJSON("/api/sources/status");
}
