"use client";
import { ErrorPanel } from "@/components/error-panel";

export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel reset={reset} />;
}
