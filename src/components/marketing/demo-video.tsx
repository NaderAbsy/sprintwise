"use client";
import { Play } from "lucide-react";
import { useRef, useState } from "react";

/** The narrated demo, with a poster and a large play button; native controls take over once it plays. */
export function DemoVideo({ transcript }: { transcript: string[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-accent/10">
        <video
          ref={video}
          controls={started}
          preload="metadata"
          playsInline
          poster="/media/demo-poster.jpg"
          className="aspect-[1440/900] w-full"
          aria-label="Sprintwise demo video, 2 minutes, with voice-over and captions"
          onPlay={() => setStarted(true)}
        >
          <source src="/media/sprintwise-demo.webm" type="video/webm" />
          <source src="/media/sprintwise-demo.mp4" type="video/mp4" />
        </video>
        {!started && (
          <button
            type="button"
            onClick={() => {
              setStarted(true);
              void video.current?.play();
            }}
            className="group absolute inset-0 grid place-items-center bg-gradient-to-t from-black/50 via-black/10 to-transparent"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-accent text-accent-foreground shadow-xl ring-8 ring-accent/25 transition-transform group-hover:scale-110">
              <Play aria-hidden="true" className="ml-1 h-8 w-8 fill-current" />
            </span>
            <span className="absolute top-4 left-4 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white">
              Watch the 2-minute demo
            </span>
          </button>
        )}
      </div>
      <details className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Read the transcript</summary>
        <ol className="mt-3 space-y-2 text-muted">
          {transcript.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
