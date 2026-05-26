"use client";

import { useRouter } from "next/navigation";

interface ClassSelectorProps {
  classes: { id: string; name: string }[];
  selectedClassId: string;
}

export default function ClassSelector({ classes, selectedClassId }: ClassSelectorProps) {
  const router = useRouter();

  return (
    <div className="relative">
      <select
        value={selectedClassId}
        onChange={(e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("classId", e.target.value);
          router.push(url.toString());
        }}
        className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-sm font-medium outline-none appearance-none cursor-pointer hover:border-yellow-400/50 transition-colors"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
    </div>
  );
}

// Small helper icon
function ChevronDown(props: any) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}