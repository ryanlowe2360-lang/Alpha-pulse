import { useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useAPI } from "../hooks/useAPI";
import { getSignalAccuracy } from "../api";
import { getCompanyName } from "../tickerNames";
import { LoadingCard, ErrorCard } from "../components/LoadingState";

export default function Accuracy() {
  const { data, loading, error, refetch } = useAPI(getSignalAccuracy);

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader />
        <LoadingCard text="Evaluating signal accuracy against market data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader />
        <ErrorCard message={error} onRetry={refetch} />
      </div>
    );
  }

  const stats = data?.stats;
  const chart = data?.chart || [];
  const outcomes = data?.outcomes || [];

  if (!stats || stats.total_signals === 0) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader />
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-700 mx-auto mb-4 flex items-center justify-center">
            <TargetIcon className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-400 font-medium">No signals to evaluate</p>
          <p className="text-sm text-gray-600 mt-1">
            Generate signal reports first, then check back after a few trading
            days
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Overall Accuracy"
          value={stats.accuracy_percent != null ? `${stats.accuracy_percent}%` : "-"}
          sub={`${stats.correct_signals} / ${stats.evaluated_signals} correct`}
          accent={
            stats.accuracy_percent > 55
              ? "emerald"
              : stats.accuracy_percent < 45
              ? "red"
              : "gray"
          }
        />
        <StatCard
          label="Avg Return / Signal"
          value={
            stats.avg_return_percent != null
              ? `${stats.avg_return_percent > 0 ? "+" : ""}${stats.avg_return_percent}%`
              : "-"
          }
          sub={`${stats.total_signals} total signals`}
          accent={
            stats.avg_return_percent > 0
              ? "emerald"
              : stats.avg_return_percent < 0
              ? "red"
              : "gray"
          }
        />
        <StatCard
          label="Best Signal"
          value={stats.best_ticker || "-"}
          sub={
            stats.best_return_percent != null
              ? `+${stats.best_return_percent}%`
              : ""
          }
          accent="emerald"
        />
        <StatCard
          label="Worst Signal"
          value={stats.worst_ticker || "-"}
          sub={
            stats.worst_return_percent != null
              ? `${stats.worst_return_percent}%`
              : ""
          }
          accent="red"
        />
      </div>

      {/* ── Buy vs Sell Accuracy ── */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          label="Buy Signal Accuracy"
          value={stats.buy_accuracy != null ? `${stats.buy_accuracy}%` : "-"}
          icon={<ArrowUpIcon className="w-4 h-4 text-emerald-400" />}
        />
        <MiniStat
          label="Sell Signal Accuracy"
          value={stats.sell_accuracy != null ? `${stats.sell_accuracy}%` : "-"}
          icon={<ArrowDownIcon className="w-4 h-4 text-red-400" />}
        />
      </div>

      {/* ── Charts ── */}
      {chart.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AccuracyChart data={chart} />
          <ReturnChart data={chart} />
        </div>
      )}

      {/* ── Outcomes Table ── */}
      <OutcomeTable outcomes={outcomes} />
    </div>
  );
}

/* ── Page Header ── */

function PageHeader() {
  return (
    <div>
      <h1 className="text-xl font-bold text-white">Signal Accuracy</h1>
      <p className="text-sm text-gray-500 mt-1">
        Historical signal performance vs. actual price movements (5-day
        evaluation window)
      </p>
    </div>
  );
}

/* ── Stat Card ── */

const ACCENT_COLORS = {
  emerald: {
    ring: "ring-emerald-500/20",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/5",
  },
  red: {
    ring: "ring-red-500/20",
    bg: "bg-red-500/5",
    text: "text-red-400",
    glow: "shadow-red-500/5",
  },
  gray: {
    ring: "ring-gray-600/30",
    bg: "bg-gray-800",
    text: "text-gray-300",
    glow: "",
  },
};

function StatCard({ label, value, sub, accent = "gray" }) {
  const c = ACCENT_COLORS[accent] || ACCENT_COLORS.gray;
  return (
    <div
      className={`rounded-lg border border-gray-700 ring-1 ${c.ring} ${c.bg} p-4 shadow-lg ${c.glow}`}
    >
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 tracking-tight ${c.text}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

/* ── Accuracy Chart ── */

function AccuracyChart({ data }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Cumulative Accuracy
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(d) => d.slice(5)}
              axisLine={{ stroke: "#374151" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <ReferenceLine
              y={50}
              stroke="#4b5563"
              strokeDasharray="4 4"
              label={{
                value: "50%",
                fill: "#6b7280",
                fontSize: 10,
                position: "left",
              }}
            />
            <Tooltip content={<AccuracyTooltip />} />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#accGrad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#34d399",
                stroke: "#064e3b",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AccuracyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 font-medium">{label}</p>
      <p className="text-emerald-400 font-bold mt-0.5">
        {d.accuracy}% accuracy
      </p>
      <p className="text-gray-500">{d.signal_count} signals evaluated</p>
    </div>
  );
}

/* ── Cumulative Return Chart ── */

function ReturnChart({ data }) {
  const minReturn = Math.min(0, ...data.map((d) => d.cumulative_return));
  const maxReturn = Math.max(0, ...data.map((d) => d.cumulative_return));
  const domainPad = Math.max(Math.abs(minReturn), Math.abs(maxReturn), 5) * 0.2;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Cumulative Return
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="retGradPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="retGradNeg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(d) => d.slice(5)}
              axisLine={{ stroke: "#374151" }}
              tickLine={false}
            />
            <YAxis
              domain={[
                Math.floor(minReturn - domainPad),
                Math.ceil(maxReturn + domainPad),
              ]}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <ReferenceLine y={0} stroke="#4b5563" strokeWidth={1.5} />
            <Tooltip content={<ReturnTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulative_return"
              stroke={
                data.length > 0 &&
                data[data.length - 1].cumulative_return >= 0
                  ? "#34d399"
                  : "#f87171"
              }
              strokeWidth={2}
              fill={
                data.length > 0 &&
                data[data.length - 1].cumulative_return >= 0
                  ? "url(#retGradPos)"
                  : "url(#retGradNeg)"
              }
              dot={false}
              activeDot={{
                r: 4,
                stroke: "#1f2937",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReturnTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const positive = d.cumulative_return >= 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 font-medium">{label}</p>
      <p
        className={`font-bold mt-0.5 ${positive ? "text-emerald-400" : "text-red-400"}`}
      >
        {positive ? "+" : ""}
        {d.cumulative_return}% cumulative
      </p>
      <p className="text-gray-500">{d.signal_count} signals</p>
    </div>
  );
}

/* ── Outcome Table ── */

const CONVICTION_COLORS = {
  "Strong Buy": "text-emerald-400",
  Buy: "text-emerald-300",
  Neutral: "text-gray-400",
  Sell: "text-orange-400",
  "Strong Sell": "text-red-400",
};

const DIRECTION_ICONS = {
  bullish: { color: "text-emerald-400", arrow: "\u2191" },
  bearish: { color: "text-red-400", arrow: "\u2193" },
  neutral: { color: "text-gray-500", arrow: "\u2192" },
};

function OutcomeTable({ outcomes }) {
  if (outcomes.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          Signal History
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                Conviction
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                Predicted
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                Actual
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider text-right">
                Return
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wider text-center">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {outcomes.map((o, i) => (
              <OutcomeRow key={`${o.generated_at}-${o.ticker}-${i}`} outcome={o} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutcomeRow({ outcome: o }) {
  const predicted = DIRECTION_ICONS[o.predicted_direction] || DIRECTION_ICONS.neutral;
  const actual = DIRECTION_ICONS[o.actual_direction] || DIRECTION_ICONS.neutral;
  const convColor = CONVICTION_COLORS[o.conviction] || "text-gray-400";
  const returnPositive = o.return_percent != null && o.return_percent > 0;
  const returnNegative = o.return_percent != null && o.return_percent < 0;

  return (
    <tr className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors">
      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
        {o.generated_at.slice(0, 10)}
      </td>
      <td className="px-4 py-2.5">
        <div>
          <span className="font-semibold text-white">{o.ticker}</span>
          <span className="text-gray-600 text-[11px] ml-1.5">
            {getCompanyName(o.ticker) !== o.ticker
              ? getCompanyName(o.ticker)
              : ""}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-medium ${convColor}`}>
          {o.conviction}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-medium ${predicted.color}`}>
          {predicted.arrow} {o.predicted_direction}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-medium ${actual.color}`}>
          {actual.arrow} {o.actual_direction}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {o.return_percent != null ? (
          <span
            className={`text-xs font-semibold tabular-nums ${
              returnPositive
                ? "text-emerald-400"
                : returnNegative
                ? "text-red-400"
                : "text-gray-500"
            }`}
          >
            {returnPositive ? "+" : ""}
            {o.return_percent}%
          </span>
        ) : (
          <span className="text-xs text-gray-600">-</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        {o.correct === true && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          </span>
        )}
        {o.correct === false && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/15 ring-1 ring-red-500/30">
            <XIcon className="w-3.5 h-3.5 text-red-400" />
          </span>
        )}
        {o.correct == null && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-700/50 ring-1 ring-gray-600/30">
            <MinusIcon className="w-3.5 h-3.5 text-gray-500" />
          </span>
        )}
      </td>
    </tr>
  );
}

/* ── Inline SVG Icons ── */

function TargetIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.01" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MinusIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
    </svg>
  );
}

function ArrowUpIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

function ArrowDownIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}
