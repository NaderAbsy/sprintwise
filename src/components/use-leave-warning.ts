"use client";
import { useEffect } from "react";

export const LEAVE_MESSAGE = "Leave without saving? Your changes to this story will be lost.";

/**
 * Asks before throwing away unsaved typing: the browser's own prompt on reload,
 * close or another site, and a confirm on links inside the app. The listener runs
 * in the capture phase, so a cancelled click never reaches Next's <Link>.
 * A save that redirects isn't a link click, so it passes without a prompt.
 */
export function useLeaveWarning(dirty: boolean, message = LEAVE_MESSAGE) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      // Other sites get the browser's prompt; a same-page #link doesn't leave.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
