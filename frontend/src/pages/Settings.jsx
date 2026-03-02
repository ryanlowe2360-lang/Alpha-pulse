import { useAPI } from "../hooks/useAPI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Settings() {
  const { data, loading } = useAPI(() =>
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .catch(() => null)
  );

  return (
    <div className="space-y-6 max-w-[700px]">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          System configuration and API status
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Backend Status
        </h2>
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              loading
                ? "bg-yellow-400 animate-pulse"
                : data?.status === "ok"
                ? "bg-emerald-400"
                : "bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-300">
            {loading
              ? "Checking..."
              : data?.status === "ok"
              ? `Connected to API (${API_URL})`
              : "Cannot reach backend"}
          </span>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          API Keys Configuration
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          API keys are configured via the <code className="text-emerald-400 text-xs bg-gray-900 px-1.5 py-0.5 rounded">.env</code> file in the backend directory.
        </p>
        <div className="space-y-3">
          <KeyRow label="Reddit API" envVars={["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"]} />
          <KeyRow label="Twitter API" envVars={["TWITTER_BEARER_TOKEN"]} />
          <KeyRow label="Finnhub" envVars={["FINNHUB_API_KEY"]} />
          <KeyRow label="Anthropic (Claude)" envVars={["ANTHROPIC_API_KEY"]} />
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Data Sources
        </h2>
        <div className="space-y-2 text-sm">
          <Row label="Social Sentiment" value="StockTwits + Reddit (PRAW) + Twitter (Tweepy / Nitter)" />
          <Row label="Market Data" value="Yahoo Finance (yfinance)" />
          <Row label="News" value="Finnhub Company News API" />
          <Row label="AI Analysis" value="Claude Sonnet via Anthropic API" />
          <Row label="Signal Storage" value="SQLite (signals.db)" />
        </div>
      </div>
    </div>
  );
}

function KeyRow({ label, envVars }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex gap-1.5">
        {envVars.map((v) => (
          <code key={v} className="text-[11px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
            {v}
          </code>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-300 text-xs">{value}</span>
    </div>
  );
}
