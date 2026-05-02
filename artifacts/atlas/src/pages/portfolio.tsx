import React, { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  format, parseISO, differenceInDays, addMonths, subMonths,
  startOfMonth, endOfMonth, eachMonthOfInterval, startOfDay, addDays,
} from "date-fns";
import {
  Users, ZoomIn, ZoomOut, CalendarCheck, AlertCircle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface AnalystCard {
  id: number;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  teamId: number;
  teamName: string;
  teamColor: string;
}

interface Analyst {
  memberId: number;
  memberName: string;
  role: string;
  teamId: number;
  teamName: string;
  teamColor: string;
  cards: AnalystCard[];
}

interface Team {
  id: number;
  name: string;
  color: string;
  slug: string;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#6366f1",
  blocked: "#ef4444",
  in_review: "#a855f7",
  done: "#22c55e",
};

const PRIORITY_BORDER: Record<string, string> = {
  low: "#3b82f6", medium: "#eab308", high: "#f97316", critical: "#ef4444",
};

const MIN_WEEK_PX = 30;
const MAX_WEEK_PX = 160;
const DEFAULT_WEEK_PX = 60;
const LABEL_COL = 200;

export default function PortfolioPage() {
  const [weekPx, setWeekPx] = useState(DEFAULT_WEEK_PX);
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const dayPx = weekPx / 7;

  const { data, isLoading } = useQuery<{ analysts: Analyst[]; teams: Team[] }>({
    queryKey: ["portfolio-utilization"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/portfolio/utilization`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const today = startOfDay(new Date());

  const analysts = useMemo(() => {
    if (!data?.analysts) return [];
    if (filterTeam === "all") return data.analysts;
    return data.analysts.filter(a => String(a.teamId) === filterTeam);
  }, [data, filterTeam]);

  const { timelineStart, timelineEnd } = useMemo(() => {
    if (!data?.analysts || analysts.length === 0) {
      return { timelineStart: subMonths(today, 1), timelineEnd: addMonths(today, 6) };
    }
    let min = today, max = today;
    analysts.forEach(a => a.cards.forEach(c => {
      if (c.startDate) { const d = parseISO(c.startDate); if (d < min) min = d; }
      if (c.dueDate) { const d = parseISO(c.dueDate); if (d > max) max = d; }
    }));
    const start = startOfMonth(subMonths(min < today ? min : today, 2));
    const naturalEnd = endOfMonth(addMonths(max > today ? max : today, 4));
    const minEnd = endOfMonth(addMonths(start, 12));
    return { timelineStart: start, timelineEnd: naturalEnd > minEnd ? naturalEnd : minEnd };
  }, [analysts, today]);

  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const canvasW = totalDays * dayPx;

  const dateToX = useCallback(
    (d: Date) => differenceInDays(startOfDay(d), timelineStart) * dayPx,
    [timelineStart, dayPx]
  );
  const todayX = dateToX(today);

  const didScroll = useRef(false);
  const handleScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el && !didScroll.current) {
      scrollRef.current = el;
      setTimeout(() => {
        if (el) {
          el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.25);
          didScroll.current = true;
        }
      }, 80);
    }
  }, [todayX]);

  const getBarStyle = (card: AnalystCard) => {
    const start = card.startDate ? startOfDay(parseISO(card.startDate)) : today;
    const end = card.dueDate ? startOfDay(parseISO(card.dueDate)) : addDays(start, 14);
    const left = Math.max(0, dateToX(start));
    const width = Math.max(dateToX(end) - left, weekPx);
    return { left, width };
  };

  // Compute load indicator (total active cards per analyst)
  const getLoad = (a: Analyst) => {
    const active = a.cards.filter(c => c.status !== "done");
    const overdue = active.filter(c => c.dueDate && parseISO(c.dueDate) < today);
    return { total: active.length, overdue: overdue.length };
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Portfolio — Analyst Utilization
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            All analysts across all teams — color coded by team. See who's overloaded before assigning new work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Team filter */}
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {data?.teams.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Zoom */}
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setWeekPx(w => Math.max(MIN_WEEK_PX, w - 10))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-12 text-center">{Math.round(weekPx)}px/wk</span>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setWeekPx(w => Math.min(MAX_WEEK_PX, w + 10))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => scrollRef.current && (scrollRef.current.scrollLeft = Math.max(0, todayX - scrollRef.current.clientWidth * 0.25))}>
            <CalendarCheck className="w-3.5 h-3.5" /> Today
          </Button>
        </div>
      </div>

      {analysts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No analysts found. Add team members to see utilization.
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Fixed label column */}
          <div className="shrink-0 border-r bg-card z-10" style={{ width: LABEL_COL }}>
            {/* Header spacer */}
            <div className="h-16 border-b bg-muted/20" />
            {analysts.map(a => {
              const { total, overdue } = getLoad(a);
              const level = total >= 8 ? "critical" : total >= 5 ? "high" : total >= 3 ? "medium" : "ok";
              return (
                <div key={a.memberId}
                  className="h-14 border-b border-border/50 px-3 flex flex-col justify-center gap-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.teamColor }} />
                    <span className="text-xs font-semibold truncate">{a.memberName}</span>
                    {overdue > 0 && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 pl-4">
                    <span className="text-[10px] text-muted-foreground">{a.teamName}</span>
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 rounded",
                      level === "critical" ? "bg-red-500/15 text-red-600" :
                      level === "high" ? "bg-orange-500/15 text-orange-600" :
                      level === "medium" ? "bg-yellow-500/15 text-yellow-600" :
                      "bg-green-500/15 text-green-600"
                    )}>
                      {total} active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={handleScrollRef}>
            <div style={{ width: canvasW, minWidth: "100%", position: "relative" }}>
              {/* Month header (2 rows) */}
              <div className="h-8 border-b bg-muted/30 relative" style={{ width: canvasW }}>
                {months.map(m => {
                  const x = dateToX(m);
                  return (
                    <div key={m.toISOString()}
                      className="absolute top-0 h-full border-l border-border/40 flex items-center pl-2"
                      style={{ left: x }}>
                      <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                        {format(m, "MMM yyyy")}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Week ticks */}
              <div className="h-8 border-b bg-muted/10 relative" style={{ width: canvasW }}>
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => {
                  const d = addDays(timelineStart, i * 7);
                  const x = dateToX(d);
                  return (
                    <div key={i} className="absolute top-0 h-full border-l border-border/20" style={{ left: x }}>
                      <span className="text-[9px] text-muted-foreground/50 ml-1 mt-1 block">
                        {format(d, "d")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Analyst rows */}
              <div className="relative" style={{ width: canvasW }}>
                {/* Today line */}
                {todayX >= 0 && todayX <= canvasW && (
                  <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayX }}>
                    <div className="w-px h-full bg-red-400 opacity-70" />
                  </div>
                )}

                {/* Month grid */}
                {months.map(m => (
                  <div key={m.toISOString()}
                    className="absolute top-0 bottom-0 border-l border-border/15 pointer-events-none"
                    style={{ left: dateToX(m) }} />
                ))}

                {analysts.map(a => {
                  const activeCards = a.cards.filter(c => c.status !== "done");
                  return (
                    <div key={a.memberId} className="h-14 border-b border-border/30 relative">
                      {/* Team color strip on left */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-60"
                        style={{ backgroundColor: a.teamColor }} />

                      {activeCards.map(card => {
                        const { left, width } = getBarStyle(card);
                        const isOverdue = card.dueDate && parseISO(card.dueDate) < today && card.status !== "done";
                        const isDone = card.status === "done";
                        return (
                          <div
                            key={card.id}
                            title={`${card.title} (${card.teamName}) — ${card.status.replace(/_/g, " ")}`}
                            className={cn(
                              "absolute top-2 h-10 rounded border text-[9px] font-medium px-1.5 flex items-center",
                              "transition-opacity hover:opacity-90 cursor-default",
                              isDone ? "opacity-40" : isOverdue ? "opacity-90" : ""
                            )}
                            style={{
                              left,
                              width: Math.max(width, 24),
                              backgroundColor: `${card.teamColor}25`,
                              borderColor: isOverdue ? "#ef4444" : `${card.teamColor}60`,
                              borderLeftWidth: 3,
                              borderLeftColor: card.teamColor,
                            }}
                          >
                            <span className="truncate">{card.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="shrink-0 px-6 py-2 border-t bg-card flex items-center gap-6 flex-wrap text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">Load levels:</div>
        {[
          { label: "1–2 (available)", cls: "bg-green-500/15 text-green-600" },
          { label: "3–4 (moderate)", cls: "bg-yellow-500/15 text-yellow-600" },
          { label: "5–7 (heavy)", cls: "bg-orange-500/15 text-orange-600" },
          { label: "8+ (overloaded)", cls: "bg-red-500/15 text-red-600" },
        ].map(({ label, cls }) => (
          <span key={label} className={cn("px-2 py-0.5 rounded text-[10px] font-medium", cls)}>{label}</span>
        ))}
        <span className="ml-4">Bars colored by team · Left border = team color · Red border = overdue</span>
      </div>
    </div>
  );
}
