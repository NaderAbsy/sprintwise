"use client";
import { BookOpen, FolderKanban, LayoutGrid, LifeBuoy, LogOut, Menu, MessageSquare, Plus, Shield, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { authClient } from "@/lib/auth-client";
import { FEEDBACK_URL } from "@/lib/site";

type Props = {
  projects: { id: string; name: string }[];
  user: { name: string; image: string | null } | null;
};

const DESKTOP = "(min-width: 1024px)";
const subscribeDesktop = (onChange: () => void) => {
  const media = matchMedia(DESKTOP);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

/** Desktop: a fixed sidebar. Phones: a top bar whose menu opens the same list as a drawer. */
export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  // Before hydration assume desktop, so the sidebar is never inert on a large screen.
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => matchMedia(DESKTOP).matches, () => true);

  // Close the drawer after navigating (adjusting state during render, not in an effect).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open || isDesktop) return;
    // Move focus into the drawer when it opens; Escape closes it and returns focus to the menu button.
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isDesktop]);

  const close = () => {
    setOpen(false);
    menuButton.current?.focus();
  };

  return (
    <>
      {/* Layers on phones: drawer (z-50) over the top bar (z-40) over the backdrop (z-30), so the close button stays clickable. */}
      <div className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          ref={menuButton}
          type="button"
          className="btn-ghost px-2"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-hidden="true" onClick={close} />
      )}

      <aside
        ref={drawer}
        id="app-nav"
        // A closed drawer is off-screen on phones; inert keeps its links out of the Tab order.
        inert={!open && !isDesktop}
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:border-r-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent {...props} pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarContent({ projects, user, pathname }: Props & { pathname: string }) {
  const router = useRouter();
  const item = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
      active ? "bg-accent-soft font-medium text-accent-soft-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <nav aria-label="App" className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <Link href="/projects" className={item(pathname === "/projects")} aria-current={pathname === "/projects" ? "page" : undefined}>
          <LayoutGrid aria-hidden="true" className="h-4 w-4" />
          All projects
        </Link>

        <div>
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <p className="eyebrow">Projects</p>
            <Link href="/projects#new-project" className="rounded p-0.5 text-subtle hover:text-foreground" title="New project">
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">New project</span>
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="px-2.5 text-sm text-subtle">No projects yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const active = pathname.startsWith(`/projects/${p.id}`);
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className={item(active)} aria-current={active ? "page" : undefined}>
                      <FolderKanban aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="eyebrow px-2.5 pb-1.5">Explore</p>
          <Link href="/guide" className={item(false)}>
            <LifeBuoy aria-hidden="true" className="h-4 w-4" />
            Guide
          </Link>
          <Link href="/demo" className={item(false)}>
            <BookOpen aria-hidden="true" className="h-4 w-4" />
            Demo
          </Link>
          <Link href="/privacy" className={item(false)}>
            <Shield aria-hidden="true" className="h-4 w-4" />
            Privacy
          </Link>
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={item(false)}>
            <MessageSquare aria-hidden="true" className="h-4 w-4" />
            Send feedback
            <span className="sr-only"> (opens GitHub in a new tab)</span>
          </a>
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-subtle">Theme</span>
          <ThemeToggle />
        </div>
        {user && (
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              className={`${item(pathname === "/account")} min-w-0 flex-1`}
              aria-current={pathname === "/account" ? "page" : undefined}
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- GitHub avatars; next/image would need a remote pattern.
                <img src={user.image} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <UserRound aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="truncate">{user.name}</span>
            </Link>
            <button
              type="button"
              className="btn-ghost px-2"
              title="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
