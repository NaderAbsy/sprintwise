"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MARKETING_LINKS } from "@/lib/site";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * The public pages' links: inline next to the logo on wide screens, a dropdown menu on phones.
 * `actions` sit at the right of the bar; `menuExtras` are added at the bottom of the phone menu.
 */
export function MarketingNav({ actions, menuExtras }: { actions?: React.ReactNode; menuExtras?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const button = useRef<HTMLButtonElement>(null);

  // Close the menu when the page changes.
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <ul className="hidden items-center gap-1 md:ml-4 md:flex">
        {MARKETING_LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
                {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="ml-auto flex items-center gap-2">
        {actions}
        <button
        ref={button}
        type="button"
        className="btn-ghost md:hidden"
        aria-expanded={open}
        aria-controls="marketing-menu"
        onClick={() => {
          setOpen(!open);
          setOpenedAt(pathname);
        }}
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      {open && (
        <div
          id="marketing-menu"
          className="animate-fade-up absolute inset-x-0 top-full border-b border-border bg-background px-4 pt-2 pb-4 shadow-xl md:hidden"
        >
          <ul className="space-y-1">
            {MARKETING_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 font-medium ${active ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-2"}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {menuExtras && <div className="mt-3 space-y-3 border-t border-border pt-3">{menuExtras}</div>}
        </div>
      )}
    </>
  );
}
