interface CandidateDisclaimerProps {
  text: string;
}

export function CandidateDisclaimer({ text }: CandidateDisclaimerProps) {
  return (
    <aside
      aria-label="Candidate demonstrator disclaimer"
      className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-xs leading-5 text-slate-300 sm:px-5"
    >
      <span className="mr-2 font-semibold text-sky-200">Candidate context.</span>
      {text}
    </aside>
  );
}
