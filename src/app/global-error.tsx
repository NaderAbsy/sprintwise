"use client";
import "./globals.css";
import { ErrorPanel } from "@/components/error-panel";

/** The last resort, when even the root layout failed: it brings its own <html>. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-background px-4 text-foreground">
        <main id="main">
          <ErrorPanel reset={reset} />
        </main>
      </body>
    </html>
  );
}
