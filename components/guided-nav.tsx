"use client";

import { useGuidedWorkflow } from "./guided-workflow-provider";

const links = [
  { href: "#incident", label: "Incident", step: 1 },
  { href: "#release-evidence", label: "Release", step: 2 },
  { href: "#diagnostics", label: "Diagnostics", step: 2 },
  { href: "#remediation", label: "Remediation", step: 3 },
  { href: "#rollback-recovery", label: "Recovery", step: 3 },
  { href: "#validation", label: "Validation", step: 4 },
  { href: "#resolution", label: "Resolution", step: 5 },
  { href: "#audit", label: "Audit", step: 1 }
] as const;

export function GuidedNav() {
  const { step } = useGuidedWorkflow();
  return (
    <nav
      className="sticky top-3 z-20 mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 p-1.5 text-xs text-slate-400 shadow-lg shadow-black/20 backdrop-blur"
      aria-label="ApplicationOps sections"
    >
      {links
        .filter((link) => step >= link.step)
        .map((link) => (
          <a
            key={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-inset"
            href={link.href}
          >
            {link.label}
          </a>
        ))}
    </nav>
  );
}
