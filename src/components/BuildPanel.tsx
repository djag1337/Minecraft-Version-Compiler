"use client";

import { useEffect, useRef, useState } from "react";
import type { Build } from "@/lib/db";
import SectionHeader from "./SectionHeader";

export default function BuildPanel({ projectId }: { projectId: string }) {
  const [build, setBuild] = useState<Build | null>(null);
  const [logs, setLogs] = useState("");
  const [triggering, setTriggering] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/builds`)
      .then((res) => res.json())
      .then((data) => {
        const builds: Build[] = data.builds ?? [];
        if (builds.length > 0) {
          setBuild(builds[0]);
          setLogs(builds[0].logs);
        }
      });
  }, [projectId]);

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight });
  }, [logs]);

  useEffect(() => {
    if (!build || build.status === "SUCCESS" || build.status === "FAILED" || build.status === "CANCELLED") return;
    const es = new EventSource(`/api/projects/${projectId}/builds/${build.id}/logs`);
    es.addEventListener("log", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLogs((prev) => prev + data.text);
    });
    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setBuild((prev) => (prev ? { ...prev, status: data.status } : prev));
      es.close();
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build?.id]);

  async function triggerBuild() {
    setTriggering(true);
    setLogs("");
    try {
      const res = await fetch(`/api/projects/${projectId}/builds`, { method: "POST" });
      const data = await res.json();
      setBuild(data.build);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <SectionHeader title="Build">
        {build && <StatusBadge status={build.status} />}
        {build?.status === "SUCCESS" && (
          <a
            className="rounded-md bg-zinc-200 px-2 py-1 text-xs transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            href={`/api/projects/${projectId}/builds/${build.id}/artifact`}
          >
            Download jar
          </a>
        )}
        <button
          className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          onClick={triggerBuild}
          disabled={triggering || build?.status === "RUNNING" || build?.status === "QUEUED"}
        >
          {triggering ? "Starting…" : "Build"}
        </button>
      </SectionHeader>
      <pre ref={logsRef} className="min-w-0 flex-1 overflow-auto bg-black p-2 font-mono text-xs text-zinc-100">
        {logs || "No build logs yet."}
      </pre>
    </div>
  );
}

function StatusBadge({ status }: { status: Build["status"] }) {
  const color: Record<Build["status"], string> = {
    QUEUED: "bg-zinc-400",
    RUNNING: "bg-blue-500",
    SUCCESS: "bg-emerald-600",
    FAILED: "bg-red-600",
    CANCELLED: "bg-zinc-400",
  };
  return <span className={`rounded px-2 py-0.5 text-white ${color[status]}`}>{status}</span>;
}
