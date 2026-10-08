/** The top of a public content page: a soft gradient, an eyebrow, a title and a lead. */
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,black,transparent)]" />
        <div className="aurora-blob absolute -top-32 left-1/4 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="animate-rise mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {children && <div className="mx-auto mt-4 max-w-2xl text-lg text-muted text-pretty">{children}</div>}
      </div>
    </section>
  );
}
