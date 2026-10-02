"use client";

/** A grid whose cards glow where the pointer is. Purely decorative; the cards work the same without it. */
export function SpotlightGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerMove={(event) => {
        const card = (event.target as HTMLElement).closest<HTMLElement>(".spotlight");
        if (!card) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--x", `${event.clientX - box.left}px`);
        card.style.setProperty("--y", `${event.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}
