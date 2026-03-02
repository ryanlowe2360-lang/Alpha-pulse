import { useMemo } from "react";
import { useAPI } from "../hooks/useAPI";
import {
  getSentiment,
  getRedditSentiment,
  getTwitterSentiment,
  getStockTwitsSentiment,
} from "../api";
import SentimentHeatmap from "../components/SentimentHeatmap";
import { LoadingCard, ErrorCard } from "../components/LoadingState";

export default function Sentiment() {
  const { data, loading, error, refetch } = useAPI(getSentiment);
  const redditSentiment = useAPI(getRedditSentiment);
  const twitterSentiment = useAPI(getTwitterSentiment);
  const stocktwitsSentiment = useAPI(getStockTwitsSentiment);

  // Merge combined tickers with StockTwits data for the table
  const mergedTickers = useMemo(() => {
    const map = {};
    for (const t of data?.tickers || []) {
      map[t.ticker] = { ...t };
    }
    for (const st of stocktwitsSentiment.data?.tickers || []) {
      if (!map[st.ticker]) {
        map[st.ticker] = {
          ticker: st.ticker,
          mentions: st.total_messages,
          score: st.score / 100,
          signal: st.signal,
          platforms: {},
        };
      }
      if (!map[st.ticker].platforms) map[st.ticker].platforms = {};
      map[st.ticker].stocktwits = st;
    }
    return Object.values(map).sort((a, b) => (b.mentions ?? 0) - (a.mentions ?? 0));
  }, [data, stocktwitsSentiment.data]);

  const heatmapTickers = useMemo(() => {
    if (data?.tickers?.length > 0) return data.tickers;
    if (stocktwitsSentiment.data?.tickers?.length > 0) {
      return stocktwitsSentiment.data.tickers.map((t) => ({
        ticker: t.ticker,
        mentions: t.total_messages,
        score: t.score / 100,
        signal: t.signal,
      }));
    }
    return [];
  }, [data, stocktwitsSentiment.data]);

  const hasData = mergedTickers.length > 0;
  const isLoading = loading && stocktwitsSentiment.loading;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-white">Sentiment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Multi-platform social sentiment analysis
        </p>
      </div>

      {isLoading ? (
        <LoadingCard text="Loading sentiment data..." />
      ) : !hasData && error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : (
        <>
          {heatmapTickers.length > 0 && (
            <SentimentHeatmap
              tickers={heatmapTickers}
              redditTickers={redditSentiment.data?.tickers}
              twitterTickers={twitterSentiment.data?.tickers}
              stocktwitsTickers={stocktwitsSentiment.data?.tickers}
            />
          )}

          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-400">Ticker</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Mentions</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Score</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Signal</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">StockTwits</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Reddit</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">X / Twitter</th>
                </tr>
              </thead>
              <tbody>
                {mergedTickers.map((t) => (
                  <tr
                    key={t.ticker}
                    className="border-b border-gray-700/50 hover:bg-gray-700/20"
                  >
                    <td className="px-4 py-2.5 font-semibold text-white">
                      {t.ticker}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">{t.mentions}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          t.score > 0.15
                            ? "text-emerald-400"
                            : t.score < -0.15
                            ? "text-red-400"
                            : "text-gray-400"
                        }
                      >
                        {t.score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <SignalBadge signal={t.signal} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {t.stocktwits
                        ? `${t.stocktwits.total_messages} (${t.stocktwits.score.toFixed(0)})`
                        : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {t.platforms?.reddit
                        ? `${t.platforms.reddit.mentions} (${t.platforms.reddit.score.toFixed(2)})`
                        : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {t.platforms?.twitter
                        ? `${t.platforms.twitter.mentions} (${t.platforms.twitter.score.toFixed(2)})`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SignalBadge({ signal }) {
  const color =
    signal === "bullish"
      ? "bg-emerald-500/15 text-emerald-300"
      : signal === "bearish"
      ? "bg-red-500/15 text-red-300"
      : "bg-gray-500/15 text-gray-400";
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
      {signal}
    </span>
  );
}
