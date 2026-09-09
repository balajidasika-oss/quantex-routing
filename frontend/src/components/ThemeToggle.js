import React, { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md
                 bg-purple-600 text-white hover:bg-purple-700
                 dark:bg-slate-800 dark:text-gray-50 dark:hover:bg-slate-700
                 border border-purple-500 dark:border-slate-700
                 transition-all flex items-center space-x-1.5"
    >
      <span>{theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
    </button>
  );
}
