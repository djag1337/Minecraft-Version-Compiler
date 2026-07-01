"use client";

import { useEffect, useRef, useState } from "react";
import type { Build } from "@/lib/db";

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
    <div className="flex h-full flex-col border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">Build</span>
          {build && <StatusBadge status={build.status} />}
        </div>
        <div className="flex items-center gap-2">
          {build?.status === "SUCCESS" && (
            <a
              className="rounded bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-800"
              href={`/api/projects/${projectId}/builds/${build.id}/artifact`}
            >
              Download jar
            </a>
          )}
          <button
            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={triggerBuild}
            disabled={triggering || build?.status === "RUNNING" || build?.status === "QUEUED"}
          >
            {triggering ? "Starting…" : "Build"}
          </button>
        </div>
      </div>
      <pre ref={logsRef} className="flex-1 overflow-auto bg-black p-2 font-mono text-xs text-zinc-100">
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
