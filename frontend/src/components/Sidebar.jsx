import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { getDataSourcesStatus } from "../api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutIcon },
  { to: "/signals", label: "Signals", icon: ZapIcon },
  { to: "/accuracy", label: "Accuracy", icon: TargetIcon },
  { to: "/sentiment", label: "Sentiment", icon: ActivityIcon },
  { to: "/options", label: "Options Flow", icon: LayersIcon },
  { to: "/news", label: "News", icon: FileTextIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-gray-950 border-r border-gray-800 flex flex-col z-20">
      <div className="px-5 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight text-white">
          <span className="text-emerald-400">Alpha</span> Pulse
        </h1>
        <p className="text-[11px] text-gray-500 mt-0.5 tracking-wide uppercase">
          Signal Engine
        </p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <DataSourcesPanel />
    </aside>
  );
}

function DataSourcesPanel() {
  const [sources, setSources] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDataSourcesStatus()
      .then((d) => { if (!cancelled) setSources(d.sources); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const DISPLAY_ORDER = ["stocktwits", "reddit", "twitter", "finnhub", "claude"];

  return (
    <div className="px-4 py-3 border-t border-gray-800">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Data Sources
      </p>
      <div className="space-y-1.5">
        {sources
          ? DISPLAY_ORDER.map((key) => {
              const src = sources[key];
              if (!src) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      src.configured ? "bg-emerald-400" : "bg-gray-600"
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      src.configured ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {src.label}
                  </span>
                </div>
              );
            })
          : DISPLAY_ORDER.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-gray-700 animate-pulse" />
                <span className="text-[11px] text-gray-700">---</span>
              </div>
            ))}
      </div>
    </div>
  );
}

/* Minimal inline SVG icons to avoid adding a dependency */

function LayoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-9.75 5.25-9.75-5.25 4.179-2.25" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 15a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
