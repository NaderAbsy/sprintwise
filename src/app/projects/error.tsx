"use client";
import { ErrorPanel } from "@/components/error-panel";

export default function ProjectsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel reset={reset} />;
}
