import { useState, useEffect } from "react";

function useMarketStatus() {
  const [status, setStatus] = useState({ label: "Closed", color: "text-gray-500", dot: "bg-gray-500" });

  useEffect(() => {
    function check() {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = et.getHours();
      const m = et.getMinutes();
      const day = et.getDay();
      const mins = h * 60 + m;

      if (day === 0 || day === 6) {
        setStatus({ label: "Weekend", color: "text-gray-500", dot: "bg-gray-500" });
      } else if (mins >= 570 && mins < 960) {
        setStatus({ label: "Market Open", color: "text-emerald-400", dot: "bg-emerald-400" });
      } else if (mins >= 540 && mins < 570) {
        setStatus({ label: "Pre-Market", color: "text-yellow-400", dot: "bg-yellow-400" });
      } else if (mins >= 960 && mins < 1200) {
        setStatus({ label: "After Hours", color: "text-yellow-400", dot: "bg-yellow-400" });
      } else {
        setStatus({ label: "Closed", color: "text-gray-500", dot: "bg-gray-500" });
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return status;
}

export default function Header() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const market = useMarketStatus();

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-gray-300">{dateStr}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${market.dot}`} />
          <span className={`text-xs font-medium ${market.color}`}>
            {market.label}
          </span>
        </div>
        <span className="text-xs text-gray-600">|</span>
        <span className="text-xs text-gray-500">
          {now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/New_York",
          })}{" "}
          ET
        </span>
      </div>
    </header>
  );
}
