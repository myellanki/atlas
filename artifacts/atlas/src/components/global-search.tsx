import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Layers, BookOpen, Users, ShieldCheck, X, ArrowRight,
  FileText, Loader2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface SearchCard       { id: number; title: string; status: string; priority: string; teamId: number; description: string | null; }
interface SearchDeliverable{ id: number; title: string; type: string; status: string; journal: string | null; cardId: number; }
interface SearchMember     { id: number; name: string; role: string | null; teamId: number; }
interface SearchIrb        { id: number; title: string; protocolNumber: string | null; pi: string | null; status: string; }

interface Results {
  cards: SearchCard[];
  deliverables: SearchDeliverable[];
  members: SearchMember[];
  irb: SearchIrb[];
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress",
  blocked: "Blocked", in_review: "In Review", done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress:  "bg-primary/10 text-primary",
  blocked:      "bg-destructive/10 text-destructive",
  in_review:    "bg-purple-100 text-purple-700",
  done:         "bg-green-100 text-green-700",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props { open: boolean; onClose: () => void; }

export default function GlobalSearch({ open, onClose }: Props) {
  const [, navigate] = useLocation();
  const { setSelectedCardId } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQ = useDebounce(query, 250);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setFocused(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch results
  useEffect(() => {
    if (!debouncedQ || debouncedQ.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    fetch(`${BASE}/api/search?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [debouncedQ]);

  const total = results
    ? results.cards.length + results.deliverables.length + results.members.length + results.irb.length
    : 0;

  const openCard = (id: number) => {
    setSelectedCardId(id);
    onClose();
  };

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  // Keyboard navigation — build flat list of items for arrow key nav
  type FlatItem = { key: string; action: () => void };
  const flatItems: FlatItem[] = results ? [
    ...results.cards.map(c => ({ key: `card-${c.id}`, action: () => openCard(c.id) })),
    ...results.deliverables.map(d => ({ key: `del-${d.id}`, action: () => { goTo("/publications"); } })),
    ...results.members.map(m => ({ key: `mem-${m.id}`, action: () => { onClose(); } })),
    ...results.irb.map(i => ({ key: `irb-${i.id}`, action: () => goTo("/irb") })),
  ] : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!flatItems.length) return;
    const idx = flatItems.findIndex(f => f.key === focused);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused(flatItems[Math.min(idx + 1, flatItems.length - 1)].key);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused(flatItems[Math.max(idx - 1, 0)].key);
    } else if (e.key === "Enter" && focused) {
      flatItems.find(f => f.key === focused)?.action();
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 border-b">
          {loading
            ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
            : <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cards, publications, members, IRB…"
            className="flex-1 h-14 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted border rounded px-1.5 py-0.5 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!query || query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search…
            </div>
          ) : loading && !results ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Searching…
            </div>
          ) : results && total === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for "<span className="font-medium">{query}</span>"
            </div>
          ) : results ? (
            <div className="py-2">
              {/* Cards */}
              {results.cards.length > 0 && (
                <Section label="Project Cards" icon={<Layers className="w-3.5 h-3.5" />}>
                  {results.cards.map(card => (
                    <ResultRow
                      key={`card-${card.id}`}
                      focused={focused === `card-${card.id}`}
                      onHover={() => setFocused(`card-${card.id}`)}
                      onClick={() => openCard(card.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{card.title}</p>
                        {card.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{card.description}</p>
                        )}
                      </div>
                      <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", STATUS_COLORS[card.status])}>
                        {STATUS_LABELS[card.status] ?? card.status}
                      </Badge>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {/* Deliverables */}
              {results.deliverables.length > 0 && (
                <Section label="Publications & Deliverables" icon={<BookOpen className="w-3.5 h-3.5" />}>
                  {results.deliverables.map(d => (
                    <ResultRow
                      key={`del-${d.id}`}
                      focused={focused === `del-${d.id}`}
                      onHover={() => setFocused(`del-${d.id}`)}
                      onClick={() => goTo("/publications")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        {d.journal && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{d.journal}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                        {d.type}
                      </Badge>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {/* Members */}
              {results.members.length > 0 && (
                <Section label="Team Members" icon={<Users className="w-3.5 h-3.5" />}>
                  {results.members.map(m => (
                    <ResultRow
                      key={`mem-${m.id}`}
                      focused={focused === `mem-${m.id}`}
                      onHover={() => setFocused(`mem-${m.id}`)}
                      onClick={() => onClose()}
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        {m.role && <p className="text-xs text-muted-foreground">{m.role}</p>}
                      </div>
                    </ResultRow>
                  ))}
                </Section>
              )}

              {/* IRB */}
              {results.irb.length > 0 && (
                <Section label="IRB Submissions" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  {results.irb.map(i => (
                    <ResultRow
                      key={`irb-${i.id}`}
                      focused={focused === `irb-${i.id}`}
                      onHover={() => setFocused(`irb-${i.id}`)}
                      onClick={() => goTo("/irb")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{i.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[i.protocolNumber, i.pi].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </ResultRow>
                  ))}
                </Section>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {results && total > 0 && (
          <div className="border-t px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{total} result{total !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="bg-muted border rounded px-1">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="bg-muted border rounded px-1">↵</kbd> open</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ focused, onHover, onClick, children }: {
  focused: boolean; onHover: () => void; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        focused ? "bg-muted" : "hover:bg-muted/60"
      )}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
