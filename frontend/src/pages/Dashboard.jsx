import { useMemo } from "react";
import { useAPI } from "../hooks/useAPI";
import {
  getSentiment,
  getRedditSentiment,
  getTwitterSentiment,
  getStockTwitsSentiment,
  getLatestSignals,
} from "../api";
import SignalCard from "../components/SignalCard";
import SentimentHeatmap from "../components/SentimentHeatmap";
import ReportSummary from "../components/ReportSummary";
import { LoadingCard, ErrorCard } from "../components/LoadingState";

export default function Dashboard() {
  const sentiment = useAPI(getSentiment);
  const redditSentiment = useAPI(getRedditSentiment);
  const twitterSentiment = useAPI(getTwitterSentiment);
  const stocktwitsSentiment = useAPI(getStockTwitsSentiment);
  const signals = useAPI(() => getLatestSignals(1));

  const latestReport =
    signals.data?.reports?.length > 0 ? signals.data.reports[0] : null;

  // Build a ticker→sentimentData lookup so SignalCards get platform breakdowns
  // Merge StockTwits data into the platforms map
  const sentimentByTicker = useMemo(() => {
    const map = {};
    for (const t of sentiment.data?.tickers || []) {
      map[t.ticker] = { ...t };
    }
    // Inject StockTwits platform data into each ticker
    for (const st of stocktwitsSentiment.data?.tickers || []) {
      if (!map[st.ticker]) {
        // Ticker only exists in StockTwits — create a synthetic entry
        map[st.ticker] = {
          ticker: st.ticker,
          mentions: st.total_messages,
          score: st.score / 100,
          signal: st.signal,
          platforms: {},
        };
      }
      if (!map[st.ticker].platforms) map[st.ticker].platforms = {};
      map[st.ticker].platforms.stocktwits = {
        score: st.score,
        mentions: st.total_messages,
      };
    }
    return map;
  }, [sentiment.data, stocktwitsSentiment.data]);

  // Determine if we have any sentiment data at all (including StockTwits-only)
  const hasSentimentData =
    (sentiment.data?.tickers?.length > 0) ||
    (stocktwitsSentiment.data?.tickers?.length > 0);
  const sentimentLoading = sentiment.loading && stocktwitsSentiment.loading;
  const sentimentError = sentiment.error && stocktwitsSentiment.error;

  // Use combined tickers, or fall back to a StockTwits-derived list
  const heatmapTickers = useMemo(() => {
    if (sentiment.data?.tickers?.length > 0) return sentiment.data.tickers;
    // StockTwits-only fallback: normalize to heatmap shape
    if (stocktwitsSentiment.data?.tickers?.length > 0) {
      return stocktwitsSentiment.data.tickers.map((t) => ({
        ticker: t.ticker,
        mentions: t.total_messages,
        score: t.score / 100,
        signal: t.signal,
      }));
    }
    return [];
  }, [sentiment.data, stocktwitsSentiment.data]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time social sentiment and AI-generated trading signals
        </p>
      </div>

      {/* Signal Cards — top tickers from latest report */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Top Signals
        </h2>
        {signals.loading ? (
          <LoadingCard text="Loading signals..." />
        ) : signals.error ? (
          <ErrorCard message={signals.error} onRetry={signals.refetch} />
        ) : latestReport ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {latestReport.signals.slice(0, 6).map((s) => (
              <SignalCard
                key={s.ticker}
                signal={s}
                sentimentData={sentimentByTicker[s.ticker]}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No signals yet"
            subtitle="Generate your first signal report from the Signals page"
          />
        )}
      </section>

      {/* Sentiment Heatmap */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Social Sentiment
        </h2>
        {sentimentLoading ? (
          <LoadingCard text="Loading sentiment data..." />
        ) : sentimentError ? (
          <ErrorCard message={sentiment.error || stocktwitsSentiment.error} onRetry={sentiment.refetch} />
        ) : hasSentimentData ? (
          <SentimentHeatmap
            tickers={heatmapTickers}
            redditTickers={redditSentiment.data?.tickers}
            twitterTickers={twitterSentiment.data?.tickers}
            stocktwitsTickers={stocktwitsSentiment.data?.tickers}
          />
        ) : (
          <EmptyState
            title="No sentiment data"
            subtitle="Configure at least one data source in .env"
          />
        )}
      </section>

      {/* AI Report Summary */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Latest AI Report
        </h2>
        {signals.loading ? (
          <LoadingCard text="Loading report..." />
        ) : signals.error ? (
          <ErrorCard message={signals.error} onRetry={signals.refetch} />
        ) : latestReport ? (
          <ReportSummary report={latestReport} />
        ) : (
          <EmptyState
            title="No reports generated"
            subtitle='Go to Signals and click "Generate Report"'
          />
        )}
      </section>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
      <p className="text-sm text-gray-400 font-medium">{title}</p>
      <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}
