import { useState, useMemo } from "react";
import { useAPI } from "../hooks/useAPI";
import { getLatestSignals, generateSignals, getSentiment, getStockTwitsSentiment } from "../api";
import SignalCard from "../components/SignalCard";
import ReportSummary from "../components/ReportSummary";
import { LoadingCard, ErrorCard, Spinner } from "../components/LoadingState";

export default function Signals() {
  const { data, loading, error, refetch } = useAPI(() => getLatestSignals(5));
  const sentiment = useAPI(getSentiment);
  const stocktwitsSentiment = useAPI(getStockTwitsSentiment);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const sentimentByTicker = useMemo(() => {
    const map = {};
    for (const t of sentiment.data?.tickers || []) {
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
      map[st.ticker].platforms.stocktwits = {
        score: st.score,
        mentions: st.total_messages,
      };
    }
    return map;
  }, [sentiment.data, stocktwitsSentiment.data]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      await generateSignals();
      refetch();
      sentiment.refetch();
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const reports = data?.reports || [];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Signals</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-generated trading signals from social sentiment and market data
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
        >
          {generating && <Spinner className="h-4 w-4" />}
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {genError && (
        <ErrorCard message={genError} onRetry={handleGenerate} />
      )}

      {loading ? (
        <LoadingCard text="Loading signal history..." />
      ) : error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : reports.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <p className="text-gray-400 font-medium">No signal reports yet</p>
          <p className="text-sm text-gray-600 mt-1">
            Click &quot;Generate Report&quot; to create your first AI analysis
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <div key={report.id || report.generated_at} className="space-y-4">
              <ReportSummary report={report} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {report.signals.map((s) => (
                  <SignalCard
                    key={s.ticker}
                    signal={s}
                    sentimentData={sentimentByTicker[s.ticker]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
