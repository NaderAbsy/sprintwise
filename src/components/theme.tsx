"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme-script";

export type ThemeChoice = "light" | "dark" | "system";
const CHANGE_EVENT = "sprintwise-theme-change";

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function choose(next: ThemeChoice) {
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be blocked; the theme still applies for this page view.
  }
  apply(next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Light / Dark / System. The choice is remembered in this browser only. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server, so no option is marked until the browser's choice is known.
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);

  useEffect(() => {
    if (choice !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
            choice === value ? "bg-surface text-foreground shadow-sm" : "text-subtle hover:text-foreground"
          }`}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
