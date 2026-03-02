export function Spinner({ className = "" }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 text-emerald-400 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function LoadingCard({ text = "Loading..." }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 flex flex-col items-center justify-center gap-3">
      <Spinner />
      <span className="text-sm text-gray-400">{text}</span>
    </div>
  );
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-red-900/50 p-6">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-lg mt-0.5">!</span>
        <div className="flex-1">
          <p className="text-sm text-red-300 font-medium">Error</p>
          <p className="text-sm text-gray-400 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
