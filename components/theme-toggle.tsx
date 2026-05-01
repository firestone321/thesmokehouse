"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";

function SunIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.5M12 18.75v2.5M4.75 12h2.5M16.75 12h2.5M6.25 6.25l1.77 1.77M15.98 15.98l1.77 1.77M17.75 6.25l-1.77 1.77M8.02 15.98l-1.77 1.77" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.8A8.5 8.5 0 1 1 9.2 3.5a7 7 0 0 0 11.3 11.3Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkTheme = mounted ? theme === "dark" : false;
  const nextThemeLabel = isDarkTheme ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-11 items-center gap-2 rounded-md border border-[#B8BAB6] bg-[#F2F2EF] px-3 text-sm font-extrabold uppercase tracking-wide text-[#242321] transition hover:border-[#8D918C] hover:bg-[#DADBD7]"
      aria-label={`Switch to ${nextThemeLabel} mode`}
      title={`Switch to ${nextThemeLabel} mode`}
    >
      {isDarkTheme ? <SunIcon /> : <MoonIcon />}
      <span className="hidden sm:inline">{isDarkTheme ? "Light" : "Dark"}</span>
    </button>
  );
}
