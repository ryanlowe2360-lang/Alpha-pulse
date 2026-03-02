import { useState } from "react";
import { useAPI } from "../hooks/useAPI";
import { getMarketData } from "../api";
import { LoadingCard, ErrorCard } from "../components/LoadingState";

const DEFAULT_TICKERS = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "AMD"];

export default function OptionsFlow() {
  const [selected, setSelected] = useState("SPY");
  const { data, loading, error, refetch } = useAPI(
    () => getMarketData(selected),
    [selected]
  );

  const options = data?.options;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-white">Options Flow</h1>
        <p className="text-sm text-gray-500 mt-1">
          Options chain data, put/call ratios, and unusual activity
        </p>
      </div>

      <div className="flex gap-1.5">
        {DEFAULT_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selected === t
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingCard text={`Loading ${selected} options data...`} />
      ) : error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : !options ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-400">No options data available for {selected}</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Put/Call Ratio" value={options.put_call_ratio?.toFixed(3) ?? "N/A"}
              color={options.put_call_ratio > 1 ? "text-red-400" : "text-emerald-400"} />
            <StatBox label="Call Volume" value={options.total_call_volume.toLocaleString()} color="text-emerald-400" />
            <StatBox label="Put Volume" value={options.total_put_volume.toLocaleString()} color="text-red-400" />
            <StatBox label="Expirations" value={options.expirations.length} />
          </div>

          {/* Market data context */}
          {data.price != null && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatBox label="Price" value={`$${data.price.toFixed(2)}`} />
              <StatBox label="Change" value={`${data.change_percent > 0 ? "+" : ""}${data.change_percent}%`}
                color={data.change_percent >= 0 ? "text-emerald-400" : "text-red-400"} />
              <StatBox label="Volume" value={data.volume?.toLocaleString() ?? "N/A"} />
              <StatBox label="RSI(14)" value={data.rsi?.toFixed(1) ?? "N/A"}
                color={data.rsi > 70 ? "text-red-400" : data.rsi < 30 ? "text-emerald-400" : "text-gray-200"} />
              <StatBox label="SMA-50" value={data.moving_averages?.sma_50 != null ? `$${data.moving_averages.sma_50.toFixed(2)}` : "N/A"} />
            </div>
          )}

          {/* Unusual activity table */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-200">Unusual Activity</h3>
            </div>
            {options.unusual_activity.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No unusual options activity detected
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Strike</th>
                    <th className="px-4 py-2 font-semibold">Exp</th>
                    <th className="px-4 py-2 font-semibold">Volume</th>
                    <th className="px-4 py-2 font-semibold">OI</th>
                    <th className="px-4 py-2 font-semibold">Vol/OI</th>
                    <th className="px-4 py-2 font-semibold">IV</th>
                  </tr>
                </thead>
                <tbody>
                  {options.unusual_activity.map((c, i) => (
                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                      <td className="px-4 py-2">
                        <span className={`text-xs font-bold uppercase ${c.type === "call" ? "text-emerald-400" : "text-red-400"}`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white font-medium">${c.strike}</td>
                      <td className="px-4 py-2 text-gray-400">{c.expiration}</td>
                      <td className="px-4 py-2 text-white">{c.volume.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-400">{c.open_interest.toLocaleString()}</td>
                      <td className="px-4 py-2 text-yellow-400 font-medium">
                        {c.open_interest > 0 ? (c.volume / c.open_interest).toFixed(1) + "x" : "-"}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {c.implied_volatility != null ? (c.implied_volatility * 100).toFixed(1) + "%" : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color = "text-white" }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
