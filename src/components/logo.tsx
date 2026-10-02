import Link from "next/link";

/** The mark is a small gauge: readiness is the product's first number. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-md font-semibold tracking-tight text-foreground">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <rect width="24" height="24" rx="7" className="fill-accent" />
        <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-accent-foreground/40" />
        <path d="M6.5 15.5a5.5 5.5 0 0 1 8.4-4.7" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-accent-foreground" />
        <circle cx="12" cy="15.5" r="1.4" className="fill-accent-foreground" />
      </svg>
      <span>Sprintwise</span>
    </Link>
  );
}
