import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, parseISO, addDays } from "date-fns";
import { Flame, ChevronLeft, ChevronRight, CalendarRange, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface WeekCard {
  id: number;
  title: string;
  teamId: number;
  teamColor: string;
  teamName: string;
}

interface AnalystWeek {
  week: string;
  count: number;
  cards: WeekCard[];
}

interface AnalystCapacity {
  memberId: number;
  memberName: string;
  teamId: number;
  teamName: string;
  teamColor: string;
  weeklyLoad: AnalystWeek[];
}

interface CapacityData {
  weeks: string[];
  analysts: AnalystCapacity[];
}

function getHeatLevel(count: number): {
  level: "empty" | "light" | "medium" | "heavy" | "critical";
  bg: string;
  text: string;
  label: string;
} {
  if (count === 0) return { level: "empty",    bg: "bg-muted/20",                text: "text-muted-foreground/40", label: "Available" };
  if (count <= 2)  return { level: "light",    bg: "bg-green-500/20",            text: "text-green-700",           label: "Light (1–2)" };
  if (count <= 4)  return { level: "medium",   bg: "bg-yellow-400/25",           text: "text-yellow-700",          label: "Moderate (3–4)" };
  if (count <= 6)  return { level: "heavy",    bg: "bg-orange-500/30",           text: "text-orange-700",          label: "Heavy (5–6)" };
  return              { level: "critical", bg: "bg-red-500/30",              text: "text-red-700",             label: `Overloaded (${count})` };
}

export default function CapacityPage() {
  const [weeksToShow, setWeeksToShow] = useState(16);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterTeam, setFilterTeam] = useState<string>("all");

  const { data, isLoading } = useQuery<CapacityData>({
    queryKey: ["portfolio-capacity", weeksToShow + weekOffset],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/portfolio/capacity?weeks=${weeksToShow + Math.max(0, weekOffset)}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const displayWeeks = useMemo(() => {
    if (!data?.weeks) return [];
    const start = Math.max(0, weekOffset);
    return data.weeks.slice(start, start + weeksToShow);
  }, [data, weeksToShow, weekOffset]);

  const analysts = useMemo(() => {
    if (!data?.analysts) return [];
    return filterTeam === "all"
      ? data.analysts
      : data.analysts.filter(a => String(a.teamId) === filterTeam);
  }, [data, filterTeam]);

  const teams = useMemo(() => {
    if (!data?.analysts) return [];
    const seen = new Set<number>();
    return data.analysts.filter(a => {
      if (seen.has(a.teamId)) return false;
      seen.add(a.teamId);
      return true;
    }).map(a => ({ id: a.teamId, name: a.teamName, color: a.teamColor }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Workload Heat Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly workload intensity per analyst — red means overloaded, green means available. For sprint planning and new project intake.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(weeksToShow)} onValueChange={v => setWeeksToShow(parseInt(v))}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[8, 12, 16, 20, 26].map(n => (
                <SelectItem key={n} value={String(n)}>{n} weeks</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setWeekOffset(o => Math.max(0, o - weeksToShow))}
            disabled={weekOffset === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setWeekOffset(o => o + weeksToShow)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
            onClick={() => setWeekOffset(0)}>
            <CalendarRange className="w-3.5 h-3.5" /> Now
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="text-muted-foreground font-semibold">Heat:</span>
        {[
          { label: "Available (0)", bg: "bg-muted/30 text-muted-foreground/60" },
          { label: "Light (1–2)", bg: "bg-green-500/20 text-green-700" },
          { label: "Moderate (3–4)", bg: "bg-yellow-400/25 text-yellow-700" },
          { label: "Heavy (5–6)", bg: "bg-orange-500/30 text-orange-700" },
          { label: "Overloaded (7+)", bg: "bg-red-500/30 text-red-700" },
        ].map(({ label, bg }) => (
          <span key={label} className={cn("px-2 py-0.5 rounded font-medium", bg)}>{label}</span>
        ))}
      </div>

      {/* Heat grid */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[180px] sticky left-0 bg-muted/30 z-10">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Analyst
                  </div>
                </th>
                {displayWeeks.map(weekStr => {
                  const d = parseISO(weekStr);
                  const isThisWeek = format(new Date(), "yyyy-MM-dd") >= weekStr &&
                    format(new Date(), "yyyy-MM-dd") <= format(addDays(d, 6), "yyyy-MM-dd");
                  return (
                    <th key={weekStr}
                      className={cn(
                        "text-center px-1 py-2 text-[10px] font-medium min-w-[52px]",
                        isThisWeek ? "bg-primary/5 text-primary" : "text-muted-foreground"
                      )}>
                      <div>{format(d, "MMM d")}</div>
                      {isThisWeek && <div className="text-[9px] font-semibold">← now</div>}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center min-w-[64px]">
                  Peak
                </th>
              </tr>
            </thead>
            <tbody>
              {analysts.length === 0 ? (
                <tr>
                  <td colSpan={displayWeeks.length + 2}
                    className="text-center py-12 text-sm text-muted-foreground">
                    No analysts found.
                  </td>
                </tr>
              ) : (
                analysts.map(analyst => {
                  const weekData = displayWeeks.map(w =>
                    analyst.weeklyLoad.find(wl => wl.week === w) ?? { week: w, count: 0, cards: [] }
                  );
                  const peak = Math.max(...weekData.map(w => w.count));
                  const peakHeat = getHeatLevel(peak);

                  return (
                    <tr key={analyst.memberId} className="border-b hover:bg-muted/10 transition-colors">
                      {/* Name cell */}
                      <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: analyst.teamColor }} />
                          <div>
                            <div className="text-xs font-semibold">{analyst.memberName}</div>
                            <div className="text-[10px] text-muted-foreground">{analyst.teamName}</div>
                          </div>
                        </div>
                      </td>

                      {/* Week cells */}
                      {weekData.map(week => {
                        const heat = getHeatLevel(week.count);
                        return (
                          <td key={week.week} className="p-1 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "w-full h-9 rounded flex items-center justify-center",
                                  "text-xs font-semibold cursor-default transition-all hover:opacity-80",
                                  heat.bg, heat.text
                                )}>
                                  {week.count > 0 ? week.count : "·"}
                                </div>
                              </TooltipTrigger>
                              {week.count > 0 && (
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs">
                                    <div className="font-semibold mb-1">
                                      {analyst.memberName} — week of {format(parseISO(week.week), "MMM d")}
                                    </div>
                                    <div className={cn("text-[11px] mb-1", heat.text)}>{heat.label}</div>
                                    <ul className="space-y-0.5">
                                      {week.cards.slice(0, 6).map(c => (
                                        <li key={c.id} className="flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: c.teamColor }} />
                                          <span className="truncate max-w-[200px]">{c.title}</span>
                                        </li>
                                      ))}
                                      {week.cards.length > 6 && (
                                        <li className="text-muted-foreground">+{week.cards.length - 6} more</li>
                                      )}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </td>
                        );
                      })}

                      {/* Peak cell */}
                      <td className="px-2 py-1 text-center border-l">
                        <span className={cn(
                          "text-[11px] font-bold px-2 py-0.5 rounded",
                          peakHeat.bg, peakHeat.text
                        )}>
                          {peak}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
