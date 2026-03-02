import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { getMarketData } from "../api";
import { getCompanyName } from "../tickerNames";

const CONVICTION_STYLES = {
  "Strong Buy": {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
    spark: "#34d399",
  },
  Buy: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20",
    spark: "#6ee7b7",
  },
  Neutral: {
    bg: "bg-gray-800/80",
    border: "border-gray-700",
    badge: "bg-gray-600/30 text-gray-300 ring-1 ring-gray-600/40",
    spark: "#9ca3af",
  },
  Sell: {
    bg: "bg-orange-500/5",
    border: "border-orange-500/20",
    badge: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/20",
    spark: "#fb923c",
  },
  "Strong Sell": {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
    spark: "#f87171",
  },
};

export default function SignalCard({ signal, sentimentData }) {
  const style = CONVICTION_STYLES[signal.conviction] || CONVICTION_STYLES.Neutral;
  const [market, setMarket] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMarketData(signal.ticker)
      .then((d) => { if (!cancelled) setMarket(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [signal.ticker]);

  const sparkData = (market?.sparkline || []).map((p, i) => ({ i, p }));
  const changeVal = market?.change_percent ?? signal.change_percent;

  // Merge platform data — prefer sentimentData prop, fall back to signal fields
  const reddit = sentimentData?.platforms?.reddit;
  const twitter = sentimentData?.platforms?.twitter;
  const stocktwits = sentimentData?.platforms?.stocktwits;
  const combinedScore = sentimentData?.score ?? signal.sentiment_score;
  const totalMentions = sentimentData?.mentions ?? signal.mention_count;

  const activePlatforms = [
    reddit && { key: "reddit", icon: RedditIcon, data: reddit },
    twitter && { key: "twitter", icon: XIcon, data: twitter },
    stocktwits && { key: "stocktwits", icon: StockTwitsIcon, data: stocktwits },
  ].filter(Boolean);

  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border} flex flex-col`}>
      {/* ── Header: ticker, name, conviction badge ── */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">
              {signal.ticker}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {getCompanyName(signal.ticker)}
            </span>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}
        >
          {signal.conviction}
        </span>
      </div>

      {/* ── Sparkline ── */}
      {sparkData.length > 1 && (
        <div className="h-12 -mx-1 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Line
                type="monotone"
                dataKey="p"
                stroke={style.spark}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Key Metrics Row ── */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 mb-3 text-[11px]">
        <Metric
          label="Price"
          value={
            market?.price != null
              ? `$${market.price.toFixed(2)}`
              : signal.current_price != null
              ? `$${signal.current_price.toFixed(2)}`
              : "-"
          }
        />
        <Metric
          label="Change"
          value={changeVal != null ? `${changeVal > 0 ? "+" : ""}${changeVal}%` : "-"}
          color={
            changeVal > 0
              ? "text-emerald-400"
              : changeVal < 0
              ? "text-red-400"
              : "text-gray-400"
          }
        />
        <Metric
          label="Sentiment"
          value={combinedScore != null ? combinedScore.toFixed(2) : "-"}
          color={
            combinedScore > 0.15
              ? "text-emerald-400"
              : combinedScore < -0.15
              ? "text-red-400"
              : "text-gray-400"
          }
        />
      </div>

      {/* ── Platform Sentiment Badges ── */}
      {activePlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activePlatforms.map(({ key, icon: Icon, data }) => (
            <PlatformBadge
              key={key}
              platform={key}
              icon={Icon}
              score={data.score}
              mentions={data.mentions}
            />
          ))}
        </div>
      )}

      {/* ── AI Thesis ── */}
      <p className="text-[13px] text-gray-300 leading-relaxed mb-3 flex-1">
        {signal.thesis}
      </p>

      {/* ── Key Data Points ── */}
      {signal.key_data_points?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {signal.key_data_points.slice(0, 4).map((dp, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400"
            >
              <SourceIcon source={dp.source} />{" "}
              {dp.point.length > 45 ? dp.point.slice(0, 45) + "..." : dp.point}
            </span>
          ))}
        </div>
      )}

      {/* ── Entry/Exit ── */}
      {(signal.entry_zone || signal.exit_zone) && (
        <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-2 border-t border-gray-700/50">
          {signal.entry_zone && (
            <span>
              Entry <span className="text-gray-300 font-medium">{signal.entry_zone}</span>
            </span>
          )}
          {signal.exit_zone && (
            <span>
              Target <span className="text-gray-300 font-medium">{signal.exit_zone}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color = "text-white" }) {
  return (
    <div>
      <span className="text-gray-500">{label}</span>
      <span className={`ml-1 font-medium ${color}`}>{value}</span>
    </div>
  );
}

function PlatformBadge({ platform, icon: Icon, score, mentions }) {
  // StockTwits scores are -100 to 100; normalize to -1..1 for color thresholds
  const normalizedScore = platform === "stocktwits" ? score / 100 : score;
  const isPositive = normalizedScore > 0.15;
  const isNegative = normalizedScore < -0.15;
  const color = isPositive
    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
    : isNegative
    ? "bg-red-500/10 text-red-400 ring-red-500/20"
    : "bg-gray-700/50 text-gray-400 ring-gray-600/30";
  const displayScore =
    platform === "stocktwits" ? score.toFixed(0) : score.toFixed(2);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md ring-1 ${color}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="opacity-70">{displayScore}</span>
      <span className="text-gray-500">({mentions})</span>
    </span>
  );
}

function SourceIcon({ source }) {
  const colors = {
    reddit: "text-orange-400",
    twitter: "text-sky-400",
    stocktwits: "text-emerald-400",
    news: "text-yellow-400",
    market_data: "text-purple-400",
    options: "text-cyan-400",
  };
  return (
    <span className={`font-semibold ${colors[source] || "text-gray-500"}`}>
      {source}
    </span>
  );
}

/* ── Platform logo icons (inline SVGs) ── */

function RedditIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.066 13.71c.147.307.22.64.22.986 0 2.024-2.37 3.667-5.286 3.667-2.916 0-5.286-1.643-5.286-3.667 0-.346.073-.68.22-.986a1.495 1.495 0 01-.468-1.078c0-.832.68-1.507 1.517-1.507.413 0 .787.167 1.057.44a7.468 7.468 0 013.96-1.18l.753-3.546a.31.31 0 01.373-.233l2.46.52a1.07 1.07 0 012.04.4c0 .593-.48 1.073-1.073 1.073s-1.073-.48-1.073-1.073l-2.207-.467-.66 3.113a7.434 7.434 0 013.887 1.173 1.507 1.507 0 012.56 1.067c0 .426-.18.813-.468 1.078zM9.6 12.8a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm4.8 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm-4.56 3.547c-.053-.053-.053-.14 0-.194a.137.137 0 01.194 0c.56.56 1.3.827 2.166.827h.02c.86 0 1.6-.267 2.16-.827a.137.137 0 01.194 0c.053.054.053.14 0 .194-.627.627-1.447.94-2.36.94h-.014c-.906 0-1.726-.313-2.36-.94z" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function StockTwitsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 3v18h18V3H3zm14.5 12.5c0 .828-.672 1.5-1.5 1.5h-2l-2 2.5L10 17H8c-.828 0-1.5-.672-1.5-1.5v-7C6.5 7.672 7.172 7 8 7h8c.828 0 1.5.672 1.5 1.5v7zM9 11.5a1 1 0 110 2 1 1 0 010-2zm3 0a1 1 0 110 2 1 1 0 010-2zm3 0a1 1 0 110 2 1 1 0 010-2z" />
    </svg>
  );
}
