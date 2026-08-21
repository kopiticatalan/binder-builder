import { useEffect, useState } from "react";

export function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="status-bar px-4 pt-3 md:px-10">
      <span>{date}</span>
      <span className="text-fg">{time}</span>
    </div>
  );
}
