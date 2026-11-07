import { useEffect, useState } from "react";
import { formatAppDate } from "../lib/dateFormat";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function SidebarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="sidebar-clock flex flex-col items-center gap-0 text-center">
      <div className="sidebar-clock-time text-[1.75rem] font-bold leading-none text-white tabular-nums">
        {formatClock(now)}
      </div>
      <div className="sidebar-clock-date text-[11px] font-light leading-tight text-white/60">{formatAppDate(now)}</div>
    </div>
  );
}
