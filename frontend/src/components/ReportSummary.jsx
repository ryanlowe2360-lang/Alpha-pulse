const CONVICTION_DOT = {
  "Strong Buy":  "bg-emerald-400",
  "Buy":         "bg-emerald-400/70",
  "Neutral":     "bg-gray-500",
  "Sell":        "bg-red-400/70",
  "Strong Sell": "bg-red-400",
};

export default function ReportSummary({ report }) {
  if (!report) return null;

  const genDate = new Date(report.generated_at);
  const timeStr = genDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = genDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const buys = report.signals.filter(
    (s) => s.conviction === "Strong Buy" || s.conviction === "Buy"
  ).length;
  const sells = report.signals.filter(
    (s) => s.conviction === "Strong Sell" || s.conviction === "Sell"
  ).length;
  const neutral = report.signals.length - buys - sells;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-200">
          AI Signal Report
        </h3>
        <span className="text-[11px] text-gray-500">
          {dateStr} {timeStr} &middot; {report.model_used.split("-").slice(0, 2).join(" ")}
        </span>
      </div>

      <div className="flex items-center gap-6 mb-4">
        <Stat label="Tickers" value={report.tickers_analyzed} />
        <Stat label="Buy" value={buys} color="text-emerald-400" />
        <Stat label="Neutral" value={neutral} color="text-gray-400" />
        <Stat label="Sell" value={sells} color="text-red-400" />
      </div>

      <div className="space-y-2">
        {report.signals.map((s) => (
          <div
            key={s.ticker}
            className="flex items-start gap-3 px-3 py-2 rounded-md bg-gray-900/50"
          >
            <span
              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                CONVICTION_DOT[s.conviction] || "bg-gray-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {s.ticker}
                </span>
                <span className="text-[11px] text-gray-500">
                  {s.conviction}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {s.thesis}
              </p>
            </div>
            {s.entry_zone && (
              <span className="text-[11px] text-gray-500 shrink-0 mt-1">
                {s.entry_zone}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-white" }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}
