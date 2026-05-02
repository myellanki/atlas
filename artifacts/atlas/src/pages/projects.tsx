import React, { useState, useMemo } from "react";
import { useListCards, useListTeams, useListMembers } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import AnalystGanttPanel from "@/components/analyst-gantt-panel";
import { format, isToday, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronRight, ChevronDown, ChartGantt, CalendarClock,
  AlertCircle, Users, Layers
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────
function quickSummary(note: string | null | undefined, dueDate: string | null | undefined): string {
  let base = "";
  if (note?.trim()) {
    const words = note.trim().split(/\s+/);
    base = words.slice(0, 9).join(" ") + (words.length > 9 ? "…" : "");
  } else if (dueDate) {
    base = "No updates yet";
  } else {
    base = "No updates or due date";
  }
  return base;
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

  // key = `${teamId}-${memberId}` — which analyst Gantt is open
  const [openGanttKey, setOpenGanttKey] = useState<string | null>(null);
  // which team sections are collapsed
  const [collapsedTeams, setCollapsedTeams] = useState<Set<number>>(new Set());
  // filter by team
  const [filterTeamId, setFilterTeamId] = useState<number | "all">("all");

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

  // Build grouped structure: team → analyst → cards
  const grouped = useMemo(() => {
    if (!allCards || !allTeams) return [];
    const teams = filterTeamId === "all" ? allTeams : allTeams.filter(t => t.id === filterTeamId);

    return teams.map(team => {
      const teamCards = allCards.filter(c => c.teamId === team.id);

      // Group by analyst (memberId or null)
      const analystMap = new Map<number | null, typeof teamCards>();
      for (const card of teamCards) {
        const key = card.assigneeId ?? null;
        if (!analystMap.has(key)) analystMap.set(key, []);
        analystMap.get(key)!.push(card);
      }

      // Sort analysts: assigned first (by name), then unassigned
      const analysts = [...analystMap.entries()]
        .map(([memberId, cards]) => {
          const member = memberId !== null ? allMembers?.find(m => m.id === memberId) : undefined;
          return {
            memberId,
            memberName: member?.name ?? "Unassigned",
            cards: cards.sort((a, b) => a.position - b.position),
          };
        })
        .sort((a, b) => {
          if (a.memberId === null) return 1;
          if (b.memberId === null) return -1;
          return a.memberName.localeCompare(b.memberName);
        });

      return { team, analysts, total: teamCards.length };
    });
  }, [allCards, allTeams, allMembers, filterTeamId]);

  const isLoading = loadingCards || loadingTeams;

  const totalCards = allCards?.length ?? 0;
  const overdueCount = allCards?.filter(c =>
    c.dueDate && isPast(parseISO(c.dueDate)) && !isToday(parseISO(c.dueDate)) && c.status !== "done"
  ).length ?? 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Page header */}
      <div className="px-6 py-5 border-b bg-card shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Project Summaries
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCards} projects across all teams
              {overdueCount > 0 && (
                <span className="ml-2 text-destructive font-medium">
                  · {overdueCount} overdue
                </span>
              )}
            </p>
          </div>

          {/* Team filter tabs */}
          {allTeams && allTeams.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setFilterTeamId("all")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  filterTeamId === "all"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Teams
              </button>
              {allTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterTeamId(filterTeamId === t.id ? "all" : t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                    filterTeamId === t.id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
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
                  {/* Team header row */}
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
                      {/* Table header */}
                      <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.7fr)_minmax(200px,2fr)_minmax(110px,0.6fr)_minmax(110px,0.7fr)] gap-x-4 px-5 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground border-b bg-muted/20">
                        <span>Project</span>
                        <span>Analyst</span>
                        <span>Quick Summary</span>
                        <span>Due Date</span>
                        <span>Status</span>
                      </div>

                      {analysts.map(({ memberId, memberName, cards }) => {
                        const ganttKey = `${team.id}-${memberId}`;
                        const isGanttOpen = openGanttKey === ganttKey;

                        return (
                          <React.Fragment key={memberId ?? "unassigned"}>
                            {/* Analyst sub-header — clickable to toggle Gantt */}
                            {memberId !== null && (
                              <button
                                className={cn(
                                  "w-full flex items-center gap-2 px-5 py-2 text-left text-sm font-medium transition-colors border-b hover:bg-muted/30 group",
                                  isGanttOpen ? "bg-primary/5 text-primary border-primary/20" : "text-muted-foreground"
                                )}
                                onClick={() => toggleGantt(team.id, memberId)}
                                title={`${isGanttOpen ? "Hide" : "Show"} Gantt chart for ${memberName}`}
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

                            {/* Card rows for this analyst */}
                            {cards.map((card, idx) => {
                              const isOverdue = card.dueDate &&
                                isPast(parseISO(card.dueDate)) &&
                                !isToday(parseISO(card.dueDate)) &&
                                card.status !== "done";
                              const isDueToday = card.dueDate &&
                                isToday(parseISO(card.dueDate)) &&
                                card.status !== "done";
                              const statusCfg = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.not_started;

                              return (
                                <div
                                  key={card.id}
                                  className={cn(
                                    "grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.7fr)_minmax(200px,2fr)_minmax(110px,0.6fr)_minmax(110px,0.7fr)] gap-x-4 px-5 py-3 items-center border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group",
                                    memberId === null && "bg-muted/10",
                                    isOverdue && "bg-destructive/5 hover:bg-destructive/10",
                                  )}
                                  onClick={() => setSelectedCardId(card.id)}
                                >
                                  {/* Project name */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[card.priority] ?? "bg-muted-foreground")}
                                      title={`${card.priority} priority`}
                                    />
                                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                      {card.title}
                                    </span>
                                  </div>

                                  {/* Analyst */}
                                  <div className="text-sm text-muted-foreground truncate">
                                    {memberId === null ? (
                                      <span className="text-muted-foreground/50 italic text-xs">Unassigned</span>
                                    ) : (
                                      memberName
                                    )}
                                  </div>

                                  {/* Quick summary */}
                                  <p className="text-xs text-muted-foreground truncate leading-snug" title={card.latestNote ?? undefined}>
                                    {quickSummary(card.latestNote, card.dueDate)}
                                  </p>

                                  {/* Due date */}
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
                                        {isOverdue && (
                                          <AlertCircle className="w-3 h-3" />
                                        )}
                                        {isDueToday && (
                                          <span className="text-[10px] font-semibold">TODAY</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/40">—</span>
                                    )}
                                  </div>

                                  {/* Status */}
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

                            {/* Gantt panel (full-width row) */}
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
