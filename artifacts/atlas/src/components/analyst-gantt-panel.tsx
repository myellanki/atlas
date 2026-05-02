import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  useGetMemberGantt,
  useUpdateCard,
  getListCardsQueryKey,
  getGetCardQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  addDays,
  addMonths,
  subMonths,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  parseISO,
  getDaysInMonth,
} from "date-fns";
import {
  CalendarIcon, ExternalLink, ZoomIn, ZoomOut,
  Minus, AlertCircle, CalendarCheck
} from "lucide-react";

// ── constants ──────────────────────────────────────────────────────────────────
const MIN_WEEK_PX = 40;
const MAX_WEEK_PX = 200;
const DEFAULT_WEEK_PX = 80;
const BIWEEK_DAYS = [1, 15];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-400",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-primary",
  blocked: "bg-destructive",
  in_review: "bg-purple-500",
  done: "bg-green-500",
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
];

interface Sprint {
  id: number;
  teamId: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: string | null;
  color: string;
}

interface AnalystGanttPanelProps {
  teamId: number;
  memberId: number;
  memberName: string;
  onClose?: () => void;
}

interface BarEditorState {
  cardId: number;
  title: string;
  status: string;
  startDate: Date | undefined;
  dueDate: Date | undefined;
  saving: boolean;
}

export default function AnalystGanttPanel({
  teamId, memberId, memberName, onClose,
}: AnalystGanttPanelProps) {
  const queryClient = useQueryClient();
  const { setSelectedCardId, role } = useAppStore();
  const [weekPx, setWeekPx] = useState(DEFAULT_WEEK_PX);
  const [openBarId, setOpenBarId] = useState<number | null>(null);
  const [editorState, setEditorState] = useState<BarEditorState | null>(null);
  const [pickingField, setPickingField] = useState<"start" | "due" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const dayPx = weekPx / 7;

  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const { data: ganttData, isLoading } = useGetMemberGantt(teamId, memberId, {
    query: { enabled: !!teamId && !!memberId },
  });

  // Fetch sprints for this team (for band overlay)
  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints", teamId],
    queryFn: async () => {
      const res = await fetch(`${base}/api/teams/${teamId}/sprints`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!teamId,
  });

  const updateCard = useUpdateCard();

  // ── Timeline bounds ──────────────────────────────────────────────────────────
  const { timelineStart, timelineEnd } = useMemo(() => {
    const today = startOfDay(new Date());
    const bars = ganttData?.bars ?? [];

    let minCard = today;
    let maxCard = today;
    bars.forEach(bar => {
      if (bar.startDate) {
        const d = startOfDay(parseISO(bar.startDate));
        if (d < minCard) minCard = d;
      }
      if (bar.dueDate) {
        const d = startOfDay(parseISO(bar.dueDate));
        if (d > maxCard) maxCard = d;
      }
    });

    // Also expand to cover sprints
    sprints.forEach(s => {
      const sd = startOfDay(parseISO(s.startDate));
      const ed = startOfDay(parseISO(s.endDate));
      if (sd < minCard) minCard = sd;
      if (ed > maxCard) maxCard = ed;
    });

    const start = startOfMonth(subMonths(minCard < today ? minCard : today, 3));
    const naturalEnd = endOfMonth(addMonths(maxCard > today ? maxCard : today, 6));
    const minEnd = endOfMonth(addMonths(start, 17));
    const end = naturalEnd > minEnd ? naturalEnd : minEnd;
    return { timelineStart: start, timelineEnd: end };
  }, [ganttData, sprints]);

  const months = useMemo(
    () => eachMonthOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd]
  );

  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const canvasWidth = totalDays * dayPx;

  const dateToX = useCallback(
    (date: Date) => differenceInDays(startOfDay(date), timelineStart) * dayPx,
    [timelineStart, dayPx]
  );

  const today = startOfDay(new Date());
  const todayX = dateToX(today);

  const scrollToToday = () => {
    if (!scrollRef.current) return;
    const containerW = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = Math.max(0, todayX - containerW * 0.3);
  };

  const didScroll = useRef(false);
  const handleScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el && !didScroll.current) {
      scrollRef.current = el;
      setTimeout(() => {
        if (el) {
          const containerW = el.clientWidth;
          el.scrollLeft = Math.max(0, todayX - containerW * 0.3);
          didScroll.current = true;
        }
      }, 50);
    }
  }, [todayX]);

  const getBarStyles = (bar: { startDate?: string | null; dueDate?: string | null }) => {
    const start = bar.startDate ? startOfDay(parseISO(bar.startDate)) : today;
    const due = bar.dueDate ? startOfDay(parseISO(bar.dueDate)) : addDays(start, 14);
    const left = Math.max(0, dateToX(start));
    const rightX = dateToX(due);
    const width = Math.max(rightX - left, weekPx);
    return { left, width };
  };

  const openEditor = (bar: any) => {
    setOpenBarId(bar.cardId);
    setEditorState({
      cardId: bar.cardId,
      title: bar.title,
      status: bar.status,
      startDate: bar.startDate ? startOfDay(parseISO(bar.startDate)) : undefined,
      dueDate: bar.dueDate ? startOfDay(parseISO(bar.dueDate)) : undefined,
      saving: false,
    });
    setPickingField(null);
  };

  const handleSave = async () => {
    if (!editorState) return;
    setEditorState(s => s && { ...s, saving: true });
    await updateCard.mutateAsync({
      cardId: editorState.cardId,
      data: {
        status: editorState.status as any,
        startDate: editorState.startDate ? format(editorState.startDate, "yyyy-MM-dd") : null,
        dueDate: editorState.dueDate ? format(editorState.dueDate, "yyyy-MM-dd") : null,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListCardsQueryKey({ teamId }) });
    queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(editorState.cardId) });
    queryClient.invalidateQueries({ queryKey: [`/api/gantt/${teamId}/member/${memberId}`] });
    setOpenBarId(null);
    setEditorState(null);
  };

  const canEdit = role === "admin";

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-8 w-4/6" />
      </div>
    );
  }

  const bars = ganttData?.bars ?? [];

  const monthHeaders = months.map(monthStart => {
    const x = dateToX(monthStart);
    const w = getDaysInMonth(monthStart) * dayPx;
    return { monthStart, x, w, label: format(monthStart, "MMM yyyy") };
  });

  const biweekTicks: { x: number; isoKey: string; dayLabel: string; isFirst: boolean }[] = [];
  months.forEach(monthStart => {
    BIWEEK_DAYS.forEach(day => {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      if (d >= timelineStart && d <= timelineEnd) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        biweekTicks.push({
          x: dateToX(d),
          isoKey: `${yyyy}-${mm}-${dd}`,
          dayLabel: String(d.getDate()),
          isFirst: day === 1,
        });
      }
    });
  });

  // Sprint band data — clamped to timeline
  const sprintBands = sprints.map(s => {
    const sd = parseISO(s.startDate);
    const ed = parseISO(s.endDate);
    const x = Math.max(0, dateToX(sd));
    const endX = dateToX(addDays(ed, 1));
    return { ...s, x, width: Math.max(0, endX - x) };
  });

  const LABEL_COL = 180;
  const HEADER_HEIGHT = 64; // two rows of 32px each

  return (
    <div className="flex flex-col bg-background border rounded-xl overflow-hidden shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{memberName}'s Timeline</span>
          <Badge variant="secondary" className="text-xs">{bars.length} projects</Badge>
          {sprints.length > 0 && (
            <div className="flex items-center gap-1">
              {sprints.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          )}
          {bars.some(b => b.dueDate && new Date(b.dueDate) < today && b.status !== "done") && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Overdue
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setWeekPx(w => Math.max(MIN_WEEK_PX, w - 20))}
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-12 text-center">{Math.round(weekPx)}px/wk</span>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setWeekPx(w => Math.min(MAX_WEEK_PX, w + 20))}
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-1" onClick={scrollToToday}>
            <CalendarCheck className="w-3 h-3" /> Today
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
              <Minus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          No cards assigned to {memberName}.
        </div>
      ) : (
        <div className="flex overflow-hidden">
          {/* Fixed label column */}
          <div className="shrink-0 border-r bg-card z-10" style={{ width: LABEL_COL }}>
            <div className="border-b bg-muted/20" style={{ height: HEADER_HEIGHT }} />
            {bars.map(bar => {
              const isOverdue = bar.dueDate && new Date(bar.dueDate) < today && bar.status !== "done";
              return (
                <div
                  key={bar.cardId}
                  className={cn(
                    "h-12 border-b border-border/50 flex items-center px-3 gap-2 cursor-pointer hover:bg-muted/30 transition-colors",
                    openBarId === bar.cardId && "bg-primary/5"
                  )}
                  onClick={() => openEditor(bar)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && openEditor(bar)}
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_COLORS[bar.status] ?? "bg-muted")} />
                  <span className={cn("text-xs truncate flex-1", isOverdue && "text-destructive font-medium")}>
                    {bar.title}
                  </span>
                  {isOverdue && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={handleScrollRef}>
            <div style={{ width: `${canvasWidth}px`, minWidth: "100%", position: "relative" }}>

              {/* Row 1: Month labels */}
              <div className="h-8 border-b bg-muted/30 relative" style={{ width: canvasWidth }}>
                {/* Sprint band labels in month row */}
                {sprintBands.map(s => (
                  <div
                    key={s.id}
                    className="absolute top-0 h-full flex items-center justify-center overflow-hidden pointer-events-none"
                    style={{ left: s.x, width: s.width }}
                  >
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate z-10"
                      style={{ backgroundColor: `${s.color}25`, color: s.color }}
                    >
                      {s.name}
                    </span>
                  </div>
                ))}
                {monthHeaders.map(({ monthStart, x, w, label }) => (
                  <div
                    key={label}
                    className="absolute top-0 h-full border-l border-border/40 flex items-end pb-0.5 pl-2 pointer-events-none"
                    style={{ left: x, width: w }}
                  >
                    <span className="text-[10px] font-semibold text-foreground/60 whitespace-nowrap overflow-hidden">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row 2: Bi-weekly tick marks */}
              <div className="h-8 border-b bg-muted/10 relative" style={{ width: canvasWidth }}>
                {biweekTicks.map(({ x, isoKey, dayLabel, isFirst }) => (
                  <div key={isoKey} className="absolute top-0 h-full flex items-center pl-1" style={{ left: x }}>
                    <div className={cn(
                      "absolute top-0 h-full border-l pointer-events-none",
                      isFirst ? "border-border/50" : "border-border/25"
                    )} />
                    <span className={cn(
                      "text-[9px] whitespace-nowrap ml-1",
                      isFirst ? "text-muted-foreground font-medium" : "text-muted-foreground/60"
                    )}>
                      {dayLabel}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bar rows */}
              <div className="relative" style={{ width: canvasWidth }}>
                {/* Sprint band shading (behind everything) */}
                {sprintBands.map(s => (
                  <div
                    key={s.id}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: s.x,
                      width: s.width,
                      backgroundColor: `${s.color}10`,
                      borderLeft: `2px solid ${s.color}40`,
                      borderRight: `1px solid ${s.color}25`,
                    }}
                  />
                ))}

                {/* Today line */}
                {todayX >= 0 && todayX <= canvasWidth && (
                  <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayX }}>
                    <div className="w-px h-full bg-red-400 opacity-80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 -ml-[5px] -mt-1 absolute top-0" />
                  </div>
                )}

                {/* Month grid lines */}
                {monthHeaders.map(({ monthStart, x }) => (
                  <div key={monthStart.toISOString()}
                    className="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none"
                    style={{ left: x }}
                  />
                ))}

                {/* Bi-weekly grid lines */}
                {biweekTicks.filter(t => !t.isFirst).map(({ x, isoKey }) => (
                  <div key={`grid-${isoKey}`}
                    className="absolute top-0 bottom-0 border-l border-border/10 pointer-events-none"
                    style={{ left: x }}
                  />
                ))}

                {bars.map(bar => {
                  const { left, width } = getBarStyles(bar);
                  const isOverdue = bar.dueDate && new Date(bar.dueDate) < today && bar.status !== "done";
                  const isDone = bar.status === "done";
                  return (
                    <div key={bar.cardId} className="h-12 border-b border-border/30 relative">
                      <Popover
                        open={openBarId === bar.cardId}
                        onOpenChange={open => {
                          if (!open) { setOpenBarId(null); setEditorState(null); }
                          else openEditor(bar);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-2 h-8 rounded-md border flex items-center px-2 gap-2 text-xs font-medium transition-all shadow-sm hover:shadow-md hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none",
                              isDone
                                ? "bg-muted/60 border-border/50 text-muted-foreground line-through"
                                : isOverdue
                                ? "bg-destructive/10 border-destructive/50 text-destructive"
                                : "bg-card border-border text-card-foreground",
                              openBarId === bar.cardId && "ring-2 ring-primary"
                            )}
                            style={{ left, width: Math.max(width, 60) }}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_COLORS[bar.priority] ?? "bg-muted")} />
                            <span className="truncate flex-1">{bar.title}</span>
                            {bar.dueDate && width > 80 && (
                              <span className="ml-auto shrink-0 opacity-60 text-[9px]">
                                {format(parseISO(bar.dueDate), "MMM d")}
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>

                        <PopoverContent className="w-80 p-0" side="bottom" align="start">
                          {editorState?.cardId === bar.cardId && (
                            <div className="flex flex-col gap-0">
                              <div className="flex items-start justify-between p-4 pb-2 border-b">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm leading-snug">{editorState.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">Card #{editorState.cardId}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mr-1 -mt-1"
                                  onClick={() => { setSelectedCardId(editorState.cardId); setOpenBarId(null); }}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </div>

                              <div className="p-4 space-y-4">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Status</Label>
                                  <Select value={editorState.status}
                                    onValueChange={v => setEditorState(s => s && { ...s, status: v })}
                                    disabled={!canEdit}
                                  >
                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[opt.value])} />
                                            {opt.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Start Date</Label>
                                    <Popover open={pickingField === "start"}
                                      onOpenChange={open => setPickingField(open ? "start" : null)}>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm"
                                          className="w-full justify-start h-8 text-xs font-normal"
                                          disabled={!canEdit}>
                                          <CalendarIcon className="w-3 h-3 mr-2 shrink-0 text-muted-foreground" />
                                          {editorState.startDate
                                            ? format(editorState.startDate, "MMM d, yyyy")
                                            : <span className="text-muted-foreground">None</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" side="bottom" align="start">
                                        <Calendar mode="single" selected={editorState.startDate}
                                          onSelect={d => { setEditorState(s => s && { ...s, startDate: d ?? undefined }); setPickingField(null); }}
                                          initialFocus
                                        />
                                        {editorState.startDate && (
                                          <div className="p-2 border-t">
                                            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                                              onClick={() => { setEditorState(s => s && { ...s, startDate: undefined }); setPickingField(null); }}>
                                              Clear date
                                            </Button>
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Due Date</Label>
                                    <Popover open={pickingField === "due"}
                                      onOpenChange={open => setPickingField(open ? "due" : null)}>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm"
                                          className="w-full justify-start h-8 text-xs font-normal"
                                          disabled={!canEdit}>
                                          <CalendarIcon className="w-3 h-3 mr-2 shrink-0 text-muted-foreground" />
                                          {editorState.dueDate
                                            ? format(editorState.dueDate, "MMM d, yyyy")
                                            : <span className="text-muted-foreground">None</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" side="bottom" align="start">
                                        <Calendar mode="single" selected={editorState.dueDate}
                                          onSelect={d => { setEditorState(s => s && { ...s, dueDate: d ?? undefined }); setPickingField(null); }}
                                          fromDate={editorState.startDate}
                                          initialFocus
                                        />
                                        {editorState.dueDate && (
                                          <div className="p-2 border-t">
                                            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                                              onClick={() => { setEditorState(s => s && { ...s, dueDate: undefined }); setPickingField(null); }}>
                                              Clear date
                                            </Button>
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
                                <Button size="sm" className="flex-1 h-8" onClick={handleSave}
                                  disabled={editorState.saving || !canEdit}>
                                  {editorState.saving ? "Saving…" : "Save Changes"}
                                </Button>
                                <Button variant="outline" size="sm" className="h-8"
                                  onClick={() => { setOpenBarId(null); setEditorState(null); }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
