import React, { useState, useMemo, useCallback, useRef } from "react";
import { useListCards, useListTeams, useListMembers } from "@workspace/api-client-react";
import { useTagsByCategory } from "@/hooks/use-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import AnalystGanttPanel from "@/components/analyst-gantt-panel";
import { format, isToday, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronRight, ChevronDown, ChartGantt, CalendarClock,
  AlertCircle, Users, Layers, Sparkles, Loader2, RefreshCw,
  Download, Database, Filter,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── helpers ─────────────────────────────────────────────────────────────────
function fallbackSummary(note: string | null | undefined, dueDate: string | null | undefined): string {
  if (note?.trim()) {
    const words = note.trim().split(/\s+/);
    return words.slice(0, 9).join(" ") + (words.length > 9 ? "…" : "");
  }
  return dueDate ? "No updates yet" : "No updates or due date";
}

function escapeCsv(val: string) {
  return `"${val.replace(/"/g, '""')}"`;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-slate-200 text-slate-700" },
  in_progress:  { label: "In Progress",  className: "bg-primary/15 text-primary" },
  blocked:      { label: "Blocked",      className: "bg-destructive/15 text-destructive" },
  in_review:    { label: "In Review",    className: "bg-purple-500/15 text-purple-600" },
  done:         { label: "Done",         className: "bg-green-500/15 text-green-700" },
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-blue-400", medium: "bg-yellow-400", high: "bg-orange-500", critical: "bg-red-600",
};

// ── component ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { setSelectedCardId } = useAppStore();
  const { data: allCards, isLoading: loadingCards } = useListCards({});
  const { data: allTeams, isLoading: loadingTeams } = useListTeams();
  const { data: allMembers } = useListMembers();
  const { data: dataSources = [] } = useTagsByCategory("data_source");
  const { data: cohorts = [] } = useTagsByCategory("cohort");

  const [openGanttKey, setOpenGanttKey] = useState<string | null>(null);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<number>>(new Set());
  const [filterTeamId, setFilterTeamId] = useState<number | "all">("all");
  const [filterDataSource, setFilterDataSource] = useState<string>("all");
  const [filterCohort, setFilterCohort] = useState<string>("all");

  const [aiSummaries, setAiSummaries] = useState<Record<number, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggleTeam = (teamId: number) =>
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });

  const toggleGantt = (teamId: number, memberId: number) => {
    const key = `${teamId}-${memberId}`;
    setOpenGanttKey(prev => (prev === key ? null : key));
  };

  // ── AI batch generation ───────────────────────────────────────────────────
  const generateSummaries = useCallback(async () => {
    if (!allCards || generating) return;
    const targetCards = filterTeamId === "all"
      ? allCards
      : allCards.filter(c => c.teamId === filterTeamId);
    if (targetCards.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const cardIds = targetCards.map(c => c.id);
    setGenerating(true);
    setLoadingIds(new Set(cardIds));

    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${base}/api/ai/batch-card-summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds }),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { cardId: number; summary?: string };
            if (parsed.summary) setAiSummaries(prev => ({ ...prev, [parsed.cardId]: parsed.summary! }));
            setLoadingIds(prev => { const next = new Set(prev); next.delete(parsed.cardId); return next; });
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") console.error("AI batch failed", err);
    } finally {
      setGenerating(false);
      setLoadingIds(new Set());
    }
  }, [allCards, filterTeamId, generating]);

  const clearSummaries = () => {
    abortRef.current?.abort();
    setAiSummaries({});
    setLoadingIds(new Set());
    setGenerating(false);
  };

  // ── Grouped data ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!allCards || !allTeams) return [];
    const teams = filterTeamId === "all" ? allTeams : allTeams.filter(t => t.id === filterTeamId);
    return teams.map(team => {
      let teamCards = allCards.filter(c => c.teamId === team.id);
      // data source / cohort filters (fields may not exist on older cards → treat as null)
      if (filterDataSource !== "all") {
        teamCards = teamCards.filter(c => (c as any).dataSource === filterDataSource);
      }
      if (filterCohort !== "all") {
        teamCards = teamCards.filter(c => (c as any).cohort === filterCohort);
      }
      const analystMap = new Map<number | null, typeof teamCards>();
      for (const card of teamCards) {
        const key = card.assigneeId ?? null;
        if (!analystMap.has(key)) analystMap.set(key, []);
        analystMap.get(key)!.push(card);
      }
      const analysts = [...analystMap.entries()]
        .map(([memberId, cards]) => {
          const member = memberId !== null ? allMembers?.find(m => m.id === memberId) : undefined;
          return { memberId, memberName: member?.name ?? "Unassigned", cards: cards.sort((a, b) => a.position - b.position) };
        })
        .sort((a, b) => {
          if (a.memberId === null) return 1;
          if (b.memberId === null) return -1;
          return a.memberName.localeCompare(b.memberName);
        });
      return { team, analysts, total: teamCards.length };
    });
  }, [allCards, allTeams, allMembers, filterTeamId, filterDataSource, filterCohort]);

  const hasTagFilters = filterDataSource !== "all" || filterCohort !== "all";

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const header = ["Team", "Analyst", "Project", "Priority", "Quick Summary", "Due Date", "Status"];
    const rows: string[][] = [header];

    for (const { team, analysts } of grouped) {
      for (const { memberName, cards } of analysts) {
        for (const card of cards) {
          const summary = aiSummaries[card.id] || fallbackSummary(card.latestNote, card.dueDate);
          rows.push([
            team.name,
            memberName,
            card.title,
            card.priority,
            summary,
            card.dueDate ? format(parseISO(card.dueDate), "MMM d, yyyy") : "",
            STATUS_CONFIG[card.status]?.label ?? card.status,
          ]);
        }
      }
    }

    const csv = rows.map(r => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-projects-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [grouped, aiSummaries]);

  const isLoading = loadingCards || loadingTeams;
  const totalCards = allCards?.length ?? 0;
  const overdueCount = allCards?.filter(c =>
    c.dueDate && isPast(parseISO(c.dueDate)) && !isToday(parseISO(c.dueDate)) && c.status !== "done"
  ).length ?? 0;
  const aiCount = Object.keys(aiSummaries).length;
  const visibleCardCount = filterTeamId === "all"
    ? (allCards?.length ?? 0)
    : (allCards?.filter(c => c.teamId === filterTeamId).length ?? 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Page header */}
      <div className="px-6 py-5 border-b bg-card shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Project Summaries
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCards} projects across all teams
              {overdueCount > 0 && (
                <span className="ml-2 text-destructive font-medium">· {overdueCount} overdue</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Team filter tabs */}
            {allTeams && allTeams.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setFilterTeamId("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    filterTeamId === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Teams
                </button>
                {allTeams.map(t => (
                  <button key={t.id}
                    onClick={() => setFilterTeamId(filterTeamId === t.id ? "all" : t.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                      filterTeamId === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {/* Data Source + Cohort filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Database className="w-3.5 h-3.5" />
                <span>Source:</span>
              </div>
              <Select value={filterDataSource} onValueChange={setFilterDataSource}>
                <SelectTrigger className={cn("h-8 text-xs w-32", filterDataSource !== "all" && "border-primary text-primary")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {dataSources.map(ds => (
                    <SelectItem key={ds.id} value={ds.name}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span>Cohort:</span>
              </div>
              <Select value={filterCohort} onValueChange={setFilterCohort}>
                <SelectTrigger className={cn("h-8 text-xs w-36", filterCohort !== "all" && "border-primary text-primary")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasTagFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                  onClick={() => { setFilterDataSource("all"); setFilterCohort("all"); }}>
                  ✕ Clear
                </Button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Export CSV */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={isLoading || grouped.length === 0}
                className="gap-1.5"
                title="Download as CSV spreadsheet"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>

              {/* Clear AI */}
              {aiCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSummaries}
                  disabled={generating}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear
                </Button>
              )}

              {/* Generate AI Summaries */}
              <Button
                size="sm"
                onClick={generateSummaries}
                disabled={generating || isLoading}
                className="gap-1.5 min-w-[160px]"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating… {visibleCardCount - loadingIds.size}/{visibleCardCount}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiCount > 0 ? "Regenerate AI Summaries" : "Generate AI Summaries"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {aiCount > 0 && !generating && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            AI summaries active for {aiCount} of {visibleCardCount} projects — exported CSV will include AI text
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No projects found.</p>
            </div>
          ) : (
            grouped.map(({ team, analysts, total }) => {
              const isCollapsed = collapsedTeams.has(team.id);
              return (
                <div key={team.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left border-b"
                    onClick={() => toggleTeam(team.id)}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <span className="font-semibold text-sm">{team.name}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{total}</Badge>
                    {team.description && (
                      <span className="text-xs text-muted-foreground ml-2 font-normal">{team.description}</span>
                    )}
                  </button>

                  {!isCollapsed && (
                    <div>
                      <div className="grid grid-cols-[minmax(200px,1.4fr)_minmax(110px,0.65fr)_minmax(200px,2fr)_minmax(105px,0.6fr)_minmax(110px,0.65fr)] gap-x-4 px-5 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground border-b bg-muted/20">
                        <span>Project</span>
                        <span>Analyst</span>
                        <span className="flex items-center gap-1">
                          Quick Summary
                          {aiCount > 0 && <Sparkles className="w-3 h-3 text-primary" />}
                        </span>
                        <span>Due Date</span>
                        <span>Status</span>
                      </div>

                      {analysts.map(({ memberId, memberName, cards }) => {
                        const ganttKey = `${team.id}-${memberId}`;
                        const isGanttOpen = openGanttKey === ganttKey;
                        return (
                          <React.Fragment key={memberId ?? "unassigned"}>
                            {memberId !== null && (
                              <button
                                className={cn(
                                  "w-full flex items-center gap-2 px-5 py-2 text-left text-sm font-medium transition-colors border-b hover:bg-muted/30 group",
                                  isGanttOpen ? "bg-primary/5 text-primary border-primary/20" : "text-muted-foreground"
                                )}
                                onClick={() => toggleGantt(team.id, memberId)}
                                title={`${isGanttOpen ? "Hide" : "Show"} Gantt for ${memberName}`}
                              >
                                <Users className={cn("w-3.5 h-3.5 shrink-0", isGanttOpen ? "text-primary" : "text-muted-foreground/60")} />
                                <span className={isGanttOpen ? "text-primary" : ""}>{memberName}</span>
                                <ChartGantt className={cn(
                                  "w-3.5 h-3.5 ml-1 transition-opacity",
                                  isGanttOpen ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-60"
                                )} />
                                <span className="ml-auto text-[11px] font-normal">
                                  {cards.length} project{cards.length !== 1 ? "s" : ""}
                                  {isGanttOpen ? " · click to close" : " · click for Gantt"}
                                </span>
                              </button>
                            )}

                            {cards.map(card => {
                              const isOverdue = card.dueDate && isPast(parseISO(card.dueDate)) && !isToday(parseISO(card.dueDate)) && card.status !== "done";
                              const isDueToday = card.dueDate && isToday(parseISO(card.dueDate)) && card.status !== "done";
                              const statusCfg = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.not_started;
                              const aiSummary = aiSummaries[card.id];
                              const isLoadingThis = loadingIds.has(card.id);

                              return (
                                <div
                                  key={card.id}
                                  className={cn(
                                    "grid grid-cols-[minmax(200px,1.4fr)_minmax(110px,0.65fr)_minmax(200px,2fr)_minmax(105px,0.6fr)_minmax(110px,0.65fr)] gap-x-4 px-5 py-3 items-center border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group",
                                    memberId === null && "bg-muted/10",
                                    isOverdue && "bg-destructive/5 hover:bg-destructive/10",
                                  )}
                                  onClick={() => setSelectedCardId(card.id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[card.priority] ?? "bg-muted-foreground")} title={`${card.priority} priority`} />
                                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{card.title}</span>
                                  </div>

                                  <div className="text-sm text-muted-foreground truncate">
                                    {memberId === null
                                      ? <span className="text-muted-foreground/50 italic text-xs">Unassigned</span>
                                      : memberName
                                    }
                                  </div>

                                  <div className="min-w-0">
                                    {isLoadingThis ? (
                                      <div className="flex items-center gap-1.5">
                                        <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                                        <div className="h-3 bg-primary/10 rounded animate-pulse flex-1 max-w-[140px]" />
                                      </div>
                                    ) : aiSummary ? (
                                      <p className="text-xs text-foreground/80 truncate leading-snug" title={aiSummary}>
                                        <Sparkles className="w-2.5 h-2.5 text-primary inline mr-1 shrink-0" />
                                        {aiSummary}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground truncate leading-snug" title={card.latestNote ?? undefined}>
                                        {fallbackSummary(card.latestNote, card.dueDate)}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    {card.dueDate ? (
                                      <span className={cn(
                                        "inline-flex items-center gap-1 text-xs font-medium",
                                        isOverdue && "text-destructive",
                                        isDueToday && "text-amber-600",
                                        !isOverdue && !isDueToday && "text-muted-foreground"
                                      )}>
                                        <CalendarClock className="w-3 h-3 shrink-0" />
                                        {format(parseISO(card.dueDate), "MMM d")}
                                        {isOverdue && <AlertCircle className="w-3 h-3" />}
                                        {isDueToday && <span className="text-[10px] font-semibold">TODAY</span>}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/40">—</span>
                                    )}
                                  </div>

                                  <div>
                                    <span className={cn(
                                      "inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full",
                                      statusCfg.className
                                    )}>
                                      {statusCfg.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {isGanttOpen && memberId !== null && (
                              <div className="border-b bg-muted/20 px-5 py-4">
                                <AnalystGanttPanel
                                  teamId={team.id}
                                  memberId={memberId}
                                  memberName={memberName}
                                  onClose={() => setOpenGanttKey(null)}
                                />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <CardDetailDrawer />
    </div>
  );
}
