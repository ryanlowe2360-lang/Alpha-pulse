import { useState, useMemo } from "react";

const VIEWS = [
  { key: "combined", label: "Combined" },
  { key: "stocktwits", label: "StockTwits" },
  { key: "reddit", label: "Reddit" },
  { key: "twitter", label: "X / Twitter" },
];

function scoreToHSL(score) {
  // Maps [-1, +1] → hue 0 (red) to 145 (green) via gray midpoint
  const clamped = Math.max(-1, Math.min(1, score));
  if (Math.abs(clamped) < 0.08) return "hsl(220, 10%, 35%)";
  const hue = clamped > 0 ? 145 : 0;
  const saturation = Math.min(Math.abs(clamped) * 100, 70);
  const lightness = 35 + Math.abs(clamped) * 15;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function computeSize(mentions, maxMentions) {
  // Scale from 48px to 110px based on mention count relative to max
  if (maxMentions === 0) return 64;
  const ratio = mentions / maxMentions;
  return Math.round(48 + ratio * 62);
}

export default function SentimentHeatmap({
  tickers,
  redditTickers,
  twitterTickers,
  stocktwitsTickers,
}) {
  const [view, setView] = useState("combined");

  // Normalise StockTwits tickers into the same shape as Reddit/Twitter
  const normalisedStocktwits = useMemo(() => {
    if (!stocktwitsTickers?.length) return null;
    return stocktwitsTickers.map((t) => ({
      ticker: t.ticker,
      mentions: t.total_messages ?? 0,
      score: (t.score ?? 0) / 100, // convert -100..100 → -1..1
      signal: t.signal,
    }));
  }, [stocktwitsTickers]);

  const displayTickers = useMemo(() => {
    if (view === "stocktwits" && normalisedStocktwits?.length) return normalisedStocktwits;
    if (view === "reddit" && redditTickers?.length) return redditTickers;
    if (view === "twitter" && twitterTickers?.length) return twitterTickers;
    return tickers || [];
  }, [view, tickers, redditTickers, twitterTickers, normalisedStocktwits]);

  const maxMentions = useMemo(
    () => Math.max(1, ...displayTickers.map((t) => getMentions(t, view))),
    [displayTickers, view]
  );

  if (!displayTickers || displayTickers.length === 0) return null;

  // Which per-platform views actually have data?
  const availableViews = VIEWS.filter((v) => {
    if (v.key === "combined") return true;
    if (v.key === "stocktwits") return normalisedStocktwits?.length > 0;
    if (v.key === "reddit") return redditTickers?.length > 0;
    if (v.key === "twitter") return twitterTickers?.length > 0;
    return false;
  });

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
      {/* ── Header with toggle ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">
            Sentiment Heatmap
          </h3>
          {availableViews.length > 1 && (
            <div className="flex rounded-md bg-gray-900/80 p-0.5">
              {availableViews.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    view === v.key
                      ? "bg-gray-700 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Legend />
      </div>

      {/* ── Heatmap tiles — flex-wrap with size proportional to mentions ── */}
      <div className="flex flex-wrap gap-1.5">
        {displayTickers.map((t) => {
          const mentions = getMentions(t, view);
          const score = getScore(t, view);
          const size = computeSize(mentions, maxMentions);
          return (
            <div
              key={t.ticker}
              className="rounded-md flex flex-col items-center justify-center shrink-0 transition-all duration-200 hover:brightness-125 cursor-default"
              style={{
                width: size,
                height: size,
                backgroundColor: scoreToHSL(score),
              }}
              title={`${t.ticker}: score ${score.toFixed(3)}, ${mentions} mentions`}
            >
              <span className="text-xs font-bold text-white leading-none drop-shadow-sm">
                {t.ticker}
              </span>
              <span className="text-[9px] text-white/70 mt-0.5 font-medium">
                {mentions}
              </span>
              <span className="text-[9px] text-white/50 leading-none">
                {score >= 0 ? "+" : ""}
                {score.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getMentions(ticker, view) {
  if (view === "reddit") return ticker.platforms?.reddit?.mentions ?? ticker.mentions;
  if (view === "twitter") return ticker.platforms?.twitter?.mentions ?? ticker.mentions;
  if (view === "stocktwits") return ticker.total_messages ?? ticker.mentions;
  return ticker.mentions;
}

function getScore(ticker, view) {
  if (view === "reddit") return ticker.platforms?.reddit?.score ?? ticker.score;
  if (view === "twitter") return ticker.platforms?.twitter?.score ?? ticker.score;
  if (view === "stocktwits") return ticker.score; // already normalised by parent
  return ticker.score;
}

function Legend() {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-16 h-2.5 rounded-sm"
        style={{
          background:
            "linear-gradient(to right, hsl(0,60%,40%), hsl(220,10%,35%), hsl(145,60%,40%))",
        }}
      />
      <div className="flex gap-3 ml-1.5 text-[10px] text-gray-500">
        <span>Bearish</span>
        <span>Bullish</span>
      </div>
    </div>
  );
}
