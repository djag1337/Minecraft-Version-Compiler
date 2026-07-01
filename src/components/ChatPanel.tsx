"use client";

import { useEffect, useRef, useState } from "react";
import type { AiMessage, ProposedEdit } from "@/lib/db";
import SectionHeader from "./SectionHeader";

interface StreamingMessage {
  role: "USER" | "ASSISTANT";
  content: string;
  proposedEdits?: ProposedEdit[] | null;
  id?: string;
}

async function streamChat(
  projectId: string,
  message: string,
  onDelta: (text: string) => void,
  onDone: (message: AiMessage) => void,
  onError: (message: string) => void,
) {
  const res = await fetch(`/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.body) {
    onError("no response body");
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const eventLine = part.split("\n").find((line) => line.startsWith("event: "));
      const dataLine = part.split("\n").find((line) => line.startsWith("data: "));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice("event: ".length);
      const data = JSON.parse(dataLine.slice("data: ".length));
      if (event === "delta") onDelta(data.text);
      else if (event === "done") onDone(data.message);
      else if (event === "error") onError(data.message);
    }
  }
}

export default function ChatPanel({ projectId, onFilesChanged }: { projectId: string; onFilesChanged: () => void }) {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/chat`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "USER", content: text }, { role: "ASSISTANT", content: "" }]);

    await streamChat(
      projectId,
      text,
      (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + delta };
          return next;
        });
      },
      (finalMessage) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = finalMessage;
          return next;
        });
        setSending(false);
      },
      (errorMessage) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "ASSISTANT", content: `Error: ${errorMessage}` };
          return next;
        });
        setSending(false);
      },
    );
  }

  async function applyEdit(messageId: string, path: string, action: "accept" | "reject") {
    const res = await fetch(`/api/projects/${projectId}/chat/edits/${messageId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, action }),
    });
    const data = await res.json();
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposedEdits: data.proposedEdits } : m)),
    );
    if (action === "accept") onFilesChanged();
  }

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="AI Chat" />
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {messages.map((message, i) => (
          <div key={message.id ?? i} className="mb-4">
            <div className="mb-1 text-xs font-medium text-zinc-500">
              {message.role === "USER" ? "You" : "Assistant"}
            </div>
            <div className="whitespace-pre-wrap">{message.content || (sending && i === messages.length - 1 ? "…" : "")}</div>
            {message.proposedEdits && message.proposedEdits.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {message.proposedEdits.map((edit) => (
                  <div key={edit.path} className="rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-mono">{edit.path}</span>
                      <span className="shrink-0 text-zinc-400">{edit.status}</span>
                    </div>
                    {edit.status === "pending" && message.id && (
                      <div className="flex gap-2">
                        <button
                          className="rounded bg-emerald-600 px-2 py-1 text-white"
                          onClick={() => applyEdit(message.id!, edit.path, "accept")}
                        >
                          Accept
                        </button>
                        <button
                          className="rounded bg-zinc-200 px-2 py-1 dark:bg-zinc-800"
                          onClick={() => applyEdit(message.id!, edit.path, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800">
        <textarea
          className="flex-1 resize-none rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          rows={2}
          placeholder="Describe the mod feature you want…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="rounded bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={send}
          disabled={sending}
        >
          Send
        </button>
      </div>
    </div>
  );
}
