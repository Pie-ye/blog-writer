"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Writer } from "@/components/writer";

function WriterShell() {
  return (
    <main className="writer-shell">
      <header className="masthead">
        <Link className="wordmark" href="/">Draftwell<span>.</span></Link>
        <button className="repo-status" type="button" disabled><span className="status-dot" /> Loading</button>
      </header>
    </main>
  );
}

export function ClientWriter() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return mounted ? <Writer /> : <WriterShell />;
}
