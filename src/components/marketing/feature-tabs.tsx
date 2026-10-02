"use client";
import { useRef, useState } from "react";

export type FeatureTab = { id: string; label: string; title: string; body: string; points: string[]; preview: React.ReactNode };

/** Tabs that follow the ARIA tabs pattern: one Tab stop, arrow keys to switch, panels linked to their tabs. */
export function FeatureTabs({ tabs }: { tabs: FeatureTab[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const jump = { Home: 0, End: tabs.length - 1 }[event.key];
    if (step === undefined && jump === undefined) return;
    event.preventDefault();
    const next = jump ?? (active + (step as number) + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Product features" onKeyDown={onKeyDown} className="mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active === i}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${
              active === i ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== i}
          tabIndex={0}
          className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.25fr]"
        >
          <div className="animate-fade-up space-y-4">
            <h3 className="text-2xl font-semibold tracking-tight">{tab.title}</h3>
            <p className="text-muted">{tab.body}</p>
            <ul className="space-y-2">
              {tab.points.map((point) => (
                <li key={point} className="flex gap-2 text-sm">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up min-w-0">{tab.preview}</div>
        </div>
      ))}
    </div>
  );
}
