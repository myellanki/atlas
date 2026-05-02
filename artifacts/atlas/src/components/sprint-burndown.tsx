import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Minus, Plus, TrendingDown, CalendarRange, CheckCircle2,
  Circle, Target, Pencil, Trash2, ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface Sprint {
  id: number;
  teamId: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: string | null;
  color: string;
  createdAt: string;
}

interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
  isFuture: boolean;
}

interface BurndownData {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  goal: string | null;
  color: string;
  totalCards: number;
  completedCards: number;
  data: BurndownPoint[];
}

interface SprintBurndownProps {
  teamId: number;
  onClose?: () => void;
}

const SPRINT_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

// ── SVG Burndown Chart ────────────────────────────────────────────────────────
function BurndownChart({ data, totalCards, color }: {
  data: BurndownPoint[];
  totalCards: number;
  color: string;
}) {
  if (data.length === 0 || totalCards === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        No cards with due dates in this sprint period yet.
      </div>
    );
  }

  const W = 580, H = 160;
  const PAD = { top: 10, right: 16, bottom: 28, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = data.length;

  const xScale = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * chartW);
  const yScale = (v: number) => PAD.top + chartH - (v / totalCards) * chartH;

  // Ideal line
  const idealD = `M ${xScale(0)} ${yScale(totalCards)} L ${xScale(n - 1)} ${yScale(0)}`;

  // Actual line (all points — future ones are dashed separately)
  const actualPast = data.filter(d => !d.isFuture);
  const firstFutureIdx = data.findIndex(d => d.isFuture);
  const actualD = actualPast
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.remaining).toFixed(1)}`)
    .join(" ");

  // Future projected (flat from last actual)
  const lastActualRemaining = actualPast.length > 0 ? actualPast[actualPast.length - 1].remaining : totalCards;
  const futureStartIdx = firstFutureIdx >= 0 ? firstFutureIdx : n;
  const futureD = futureStartIdx < n
    ? `M ${xScale(futureStartIdx - 1).toFixed(1)} ${yScale(lastActualRemaining).toFixed(1)} L ${xScale(n - 1).toFixed(1)} ${yScale(lastActualRemaining).toFixed(1)}`
    : "";

  // Area under actual line
  const areaD = actualPast.length > 1
    ? `${actualD} L ${xScale(actualPast.length - 1).toFixed(1)} ${yScale(0).toFixed(1)} L ${xScale(0).toFixed(1)} ${yScale(0).toFixed(1)} Z`
    : "";

  // Y axis ticks (0, half, max)
  const yTicks = [0, Math.round(totalCards / 2), totalCards];

  // X axis labels (first, middle, last + today)
  const xLabels: { i: number; label: string; isToday?: boolean }[] = [];
  xLabels.push({ i: 0, label: format(parseISO(data[0].date), "MMM d") });
  if (n > 4) xLabels.push({ i: Math.floor(n / 2), label: format(parseISO(data[Math.floor(n / 2)].date), "MMM d") });
  xLabels.push({ i: n - 1, label: format(parseISO(data[n - 1].date), "MMM d") });

  // Today marker index
  const todayIdx = data.findIndex(d => d.isFuture) - 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160 }}
      aria-label="Sprint burndown chart"
    >
      {/* Grid lines */}
      {yTicks.map(v => (
        <line
          key={v}
          x1={PAD.left} y1={yScale(v)}
          x2={W - PAD.right} y2={yScale(v)}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
          className="text-foreground"
        />
      ))}

      {/* Y axis labels */}
      {yTicks.map(v => (
        <text
          key={v}
          x={PAD.left - 4}
          y={yScale(v) + 3.5}
          textAnchor="end"
          fontSize="9"
          fill="currentColor"
          opacity="0.45"
          className="text-foreground"
        >
          {v}
        </text>
      ))}

      {/* X axis labels */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={xScale(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill="currentColor"
          opacity="0.45"
          className="text-foreground"
        >
          {label}
        </text>
      ))}

      {/* Today vertical line */}
      {todayIdx >= 0 && todayIdx < n && (
        <line
          x1={xScale(todayIdx)} y1={PAD.top}
          x2={xScale(todayIdx)} y2={PAD.top + chartH}
          stroke="#ef4444"
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="3 2"
        />
      )}

      {/* Ideal line (dashed) */}
      <path
        d={idealD}
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeDasharray="5 3"
        fill="none"
      />

      {/* Area fill under actual */}
      {areaD && (
        <path
          d={areaD}
          fill={color}
          fillOpacity="0.08"
        />
      )}

      {/* Actual line */}
      {actualD && (
        <path
          d={actualD}
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Future projected line */}
      {futureD && (
        <path
          d={futureD}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
          strokeOpacity="0.45"
        />
      )}

      {/* Last actual point dot */}
      {actualPast.length > 0 && (
        <circle
          cx={xScale(actualPast.length - 1)}
          cy={yScale(actualPast[actualPast.length - 1].remaining)}
          r="3.5"
          fill={color}
        />
      )}
    </svg>
  );
}

// ── Sprint creation form ──────────────────────────────────────────────────────
function CreateSprintForm({ teamId, onCreated, colorIndex }: {
  teamId: number;
  onCreated: (sprint: Sprint) => void;
  colorIndex: number;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(SPRINT_COLORS[colorIndex % SPRINT_COLORS.length]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;
    setSaving(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/teams/${teamId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate, goal: goal || undefined, color }),
      });
      if (res.ok) {
        const sprint = await res.json();
        queryClient.invalidateQueries({ queryKey: ["sprints", teamId] });
        onCreated(sprint);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-muted/20 rounded-lg border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Sprint</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 space-y-1">
          <Label className="text-xs">Sprint Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sprint 1, Sprint 14"
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-1.5 items-center h-8">
            {SPRINT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sprint Goal <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="What does the team aim to deliver this sprint?"
          className="h-14 text-sm resize-none"
        />
      </div>
      <Button type="submit" size="sm" className="w-full h-8" disabled={saving || !name || !startDate || !endDate}>
        {saving ? "Creating…" : "Create Sprint"}
      </Button>
    </form>
  );
}

// ── Main burndown panel ───────────────────────────────────────────────────────
export default function SprintBurndown({ teamId, onClose }: SprintBurndownProps) {
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  // Fetch sprints for team
  const { data: sprints = [], isLoading: loadingSprints } = useQuery<Sprint[]>({
    queryKey: ["sprints", teamId],
    queryFn: async () => {
      const res = await fetch(`${base}/api/teams/${teamId}/sprints`);
      if (!res.ok) throw new Error("Failed to fetch sprints");
      return res.json();
    },
    enabled: !!teamId,
  });

  // Auto-select the most recent sprint
  const activeSprint = selectedSprintId
    ? sprints.find(s => s.id === selectedSprintId)
    : sprints[sprints.length - 1] ?? null;

  // Fetch burndown data for selected sprint
  const { data: burndown, isLoading: loadingBurndown } = useQuery<BurndownData>({
    queryKey: ["burndown", activeSprint?.id],
    queryFn: async () => {
      const res = await fetch(`${base}/api/sprints/${activeSprint!.id}/burndown`);
      if (!res.ok) throw new Error("Failed to fetch burndown");
      return res.json();
    },
    enabled: !!activeSprint,
    refetchInterval: 30_000,
  });

  const deleteSprint = useCallback(async (sprintId: number) => {
    await fetch(`${base}/api/sprints/${sprintId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["sprints", teamId] });
    if (selectedSprintId === sprintId) setSelectedSprintId(null);
  }, [base, teamId, selectedSprintId, queryClient]);

  const handleSprintCreated = (sprint: Sprint) => {
    setSelectedSprintId(sprint.id);
    setShowCreate(false);
  };

  // Derived stats
  const today = new Date();
  const sprintDaysTotal = activeSprint
    ? differenceInDays(parseISO(activeSprint.endDate), parseISO(activeSprint.startDate)) + 1
    : 0;
  const sprintDaysLeft = activeSprint
    ? Math.max(0, differenceInDays(parseISO(activeSprint.endDate), today))
    : 0;
  const sprintDaysElapsed = activeSprint
    ? Math.max(0, Math.min(sprintDaysTotal, differenceInDays(today, parseISO(activeSprint.startDate)) + 1))
    : 0;
  const isActive = activeSprint
    ? today >= parseISO(activeSprint.startDate) && today <= parseISO(activeSprint.endDate)
    : false;

  return (
    <div className="flex flex-col bg-background border rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Sprint Burndown</span>

          {/* Sprint selector */}
          {sprints.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs font-medium">
                  {activeSprint
                    ? <><span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: activeSprint.color }} />{activeSprint.name}</>
                    : "Select sprint"
                  }
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {sprints.map(s => (
                  <DropdownMenuItem key={s.id} className="flex items-center justify-between gap-2"
                    onClick={() => setSelectedSprintId(s.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate text-xs">{s.name}</span>
                    </div>
                    <button
                      className="opacity-40 hover:opacity-100 shrink-0"
                      onClick={e => { e.stopPropagation(); deleteSprint(s.id); }}
                      title="Delete sprint"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5 mr-2" /> New sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {activeSprint && (
            <Badge variant="secondary" className={cn(
              "text-[10px] px-1.5 py-0",
              isActive ? "bg-green-500/15 text-green-700" : "bg-muted text-muted-foreground"
            )}>
              {isActive ? `Day ${sprintDaysElapsed}/${sprintDaysTotal}` : (
                today < parseISO(activeSprint.startDate) ? "Upcoming" : "Completed"
              )}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!showCreate && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs"
              onClick={() => setShowCreate(true)}
              title="Create new sprint"
            >
              <Plus className="w-3 h-3" /> Sprint
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
              <Minus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Sprint creation form */}
        {showCreate && (
          <div>
            <CreateSprintForm
              teamId={teamId}
              colorIndex={sprints.length}
              onCreated={handleSprintCreated}
            />
            {sprints.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground"
                onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* No sprints + no form */}
        {!showCreate && sprints.length === 0 && !loadingSprints && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="mb-3">No sprints yet. Create one to start tracking.</p>
          </div>
        )}

        {/* Sprint stats + chart */}
        {activeSprint && !showCreate && (
          <>
            {/* Goal */}
            {activeSprint.goal && (
              <div className="flex items-start gap-2 bg-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground">
                <Target className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                <span>{activeSprint.goal}</span>
              </div>
            )}

            {/* Stats row */}
            {loadingBurndown ? (
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : burndown ? (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    {
                      label: "Total Cards",
                      value: burndown.totalCards,
                      icon: <Circle className="w-3.5 h-3.5" />,
                      cls: "text-foreground"
                    },
                    {
                      label: "Completed",
                      value: burndown.completedCards,
                      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                      cls: "text-green-600"
                    },
                    {
                      label: "Remaining",
                      value: burndown.totalCards - burndown.completedCards,
                      icon: <TrendingDown className="w-3.5 h-3.5" />,
                      cls: burndown.totalCards - burndown.completedCards > 0 ? "text-amber-600" : "text-green-600"
                    },
                    {
                      label: "Days Left",
                      value: sprintDaysLeft,
                      icon: <CalendarRange className="w-3.5 h-3.5" />,
                      cls: sprintDaysLeft <= 2 && isActive ? "text-destructive" : "text-foreground"
                    },
                  ].map(stat => (
                    <div key={stat.label} className="bg-muted/30 rounded-lg p-3 flex flex-col gap-1">
                      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", stat.cls)}>
                        {stat.icon}
                        <span>{stat.label}</span>
                      </div>
                      <span className={cn("text-xl font-bold", stat.cls)}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="bg-muted/10 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {format(parseISO(activeSprint.startDate), "MMM d")} – {format(parseISO(activeSprint.endDate), "MMM d, yyyy")}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2"/></svg>
                        Ideal
                      </span>
                      <span className="flex items-center gap-1">
                        <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={activeSprint.color} strokeWidth="2"/></svg>
                        Actual
                      </span>
                    </div>
                  </div>
                  <BurndownChart
                    data={burndown.data}
                    totalCards={burndown.totalCards}
                    color={activeSprint.color}
                  />
                  {burndown.totalCards === 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Cards with due dates between {format(parseISO(activeSprint.startDate), "MMM d")} and {format(parseISO(activeSprint.endDate), "MMM d")} will appear here.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
