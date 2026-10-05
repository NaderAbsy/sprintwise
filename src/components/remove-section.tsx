import { useId } from "react";

/** A delete button kept at the foot of a page, away from everyday buttons such as Edit. */
export function RemoveSection({ title, children, action }: { title: string; children: React.ReactNode; action: React.ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6"
    >
      <div className="max-w-xl">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{children}</p>
      </div>
      {action}
    </section>
  );
}
