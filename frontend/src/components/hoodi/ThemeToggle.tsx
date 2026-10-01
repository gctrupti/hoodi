import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check local storage or system preference
    const stored = localStorage.getItem("hoodi-theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("hoodi-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-ink transition duration-200 hover:bg-sand hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-2xs",
        className
      )}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      )}
    </button>
  );
}
