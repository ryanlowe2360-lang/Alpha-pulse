import { useState } from "react";
import { useAPI } from "../hooks/useAPI";
import { getNews } from "../api";
import { LoadingCard, ErrorCard } from "../components/LoadingState";

const DEFAULT_TICKERS = ["AAPL", "TSLA", "NVDA", "MSFT", "SPY", "AMD"];

export default function News() {
  const [selected, setSelected] = useState("AAPL");
  const { data, loading, error, refetch } = useAPI(
    () => getNews(selected),
    [selected]
  );

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-xl font-bold text-white">News</h1>
        <p className="text-sm text-gray-500 mt-1">
          Latest financial news via Finnhub
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
        <LoadingCard text={`Loading ${selected} news...`} />
      ) : error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : !data?.articles?.length ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-400">No news articles found for {selected}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors group"
            >
              <div className="flex gap-4">
                {article.image && (
                  <img
                    src={article.image}
                    alt=""
                    className="w-20 h-14 rounded object-cover shrink-0 bg-gray-700"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors leading-snug">
                    {article.headline}
                  </h3>
                  {article.summary && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-600">
                    <span>{article.source}</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(article.published_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
