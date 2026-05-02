import React, { useState, useMemo } from "react";
import {
  useGetMemberGantt,
  useUpdateCard,
  getListCardsQueryKey,
  getGetCardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  parseISO,
} from "date-fns";
import { CalendarIcon, ExternalLink, ZoomIn, ZoomOut, Minus, ChevronRight, AlertCircle } from "lucide-react";

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
  teamId,
  memberId,
  memberName,
  onClose,
}: AnalystGanttPanelProps) {
  const queryClient = useQueryClient();
  const { setSelectedCardId, role } = useAppStore();
  const [zoom, setZoom] = useState(1);
  const [openBarId, setOpenBarId] = useState<number | null>(null);
  const [editorState, setEditorState] = useState<BarEditorState | null>(null);
  const [pickingField, setPickingField] = useState<"start" | "due" | null>(null);

  const dayWidth = 36 * zoom;

  const { data: ganttData, isLoading } = useGetMemberGantt(teamId, memberId, {
    query: { enabled: !!teamId && !!memberId },
  });

  const updateCard = useUpdateCard();

  const { minDate, totalDays } = useMemo(() => {
    const bars = ganttData?.bars ?? [];
    const today = startOfDay(new Date());
    if (!bars.length) {
      return { minDate: addDays(today, -7), totalDays: 42 };
    }
    let min = today;
    let max = today;
    bars.forEach((bar) => {
      if (bar.startDate) {
        const d = startOfDay(parseISO(bar.startDate));
        if (d < min) min = d;
      }
      if (bar.dueDate) {
        const d = startOfDay(parseISO(bar.dueDate));
        if (d > max) max = d;
      }
    });
    min = addDays(min, -5);
    max = addDays(max, 10);
    return { minDate: startOfDay(min), totalDays: differenceInDays(max, min) };
  }, [ganttData]);

  const days = useMemo(
    () => Array.from({ length: totalDays + 1 }, (_, i) => addDays(minDate, i)),
    [minDate, totalDays]
  );

  const today = startOfDay(new Date());
  const todayOffset = differenceInDays(today, minDate) * dayWidth;

  const getBarStyles = (bar: { startDate?: string | null; dueDate?: string | null }) => {
    const start = bar.startDate ? startOfDay(parseISO(bar.startDate)) : today;
    const due = bar.dueDate ? startOfDay(parseISO(bar.dueDate)) : addDays(start, 3);
    const leftDays = Math.max(0, differenceInDays(start, minDate));
    const widthDays = Math.max(1, differenceInDays(due, start));
    return {
      left: leftDays * dayWidth,
      width: Math.max(widthDays * dayWidth, 80),
    };
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
    setEditorState((s) => s && { ...s, saving: true });
    await updateCard.mutateAsync({
      cardId: editorState.cardId,
      data: {
        status: editorState.status as any,
        startDate: editorState.startDate
          ? format(editorState.startDate, "yyyy-MM-dd")
          : null,
        dueDate: editorState.dueDate
          ? format(editorState.dueDate, "yyyy-MM-dd")
          : null,
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

  return (
    <div className="flex flex-col bg-background border rounded-xl overflow-hidden shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{memberName}'s Timeline</span>
          <Badge variant="secondary" className="text-xs">{bars.length} cards</Badge>
          {bars.some(b => b.dueDate && new Date(b.dueDate) < today && b.status !== "done") && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Overdue
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose} aria-label="Close gantt">
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
          {/* Row labels */}
          <div className="shrink-0 border-r bg-card z-10" style={{ width: 180 }}>
            <div className="h-9 border-b bg-muted/20" />
            {bars.map((bar) => {
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
                  onKeyDown={(e) => e.key === "Enter" && openEditor(bar)}
                  aria-label={`Edit ${bar.title}`}
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

          {/* Timeline canvas */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div style={{ width: `${(totalDays + 1) * dayWidth}px`, minWidth: "100%" }}>
              {/* Day headers */}
              <div className="h-9 border-b bg-muted/20 flex items-end relative">
                {days.map((day, i) => {
                  const isFirstOfMonth = day.getDate() === 1;
                  const isToday = differenceInDays(day, today) === 0;
                  return (
                    <div
                      key={i}
                      className="absolute bottom-0 border-l border-border/30 flex items-end pb-1 px-0.5"
                      style={{ left: i * dayWidth, width: dayWidth }}
                    >
                      <span
                        className={cn(
                          "text-[9px] truncate",
                          isToday && "text-primary font-bold",
                          isFirstOfMonth ? "text-foreground font-semibold text-[10px]" : "text-muted-foreground"
                        )}
                      >
                        {isFirstOfMonth ? format(day, "MMM d") : format(day, "d")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400 opacity-70 z-10 pointer-events-none"
                    style={{ left: todayOffset }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-400 -ml-[3px] -mt-1" />
                  </div>
                )}

                {/* Background grid */}
                {days.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/15 pointer-events-none"
                    style={{ left: i * dayWidth }}
                  />
                ))}

                {bars.map((bar) => {
                  const { left, width } = getBarStyles(bar);
                  const isOverdue = bar.dueDate && new Date(bar.dueDate) < today && bar.status !== "done";
                  const isDone = bar.status === "done";
                  return (
                    <div key={bar.cardId} className="h-12 border-b border-border/30 relative">
                      <Popover
                        open={openBarId === bar.cardId}
                        onOpenChange={(open) => {
                          if (!open) { setOpenBarId(null); setEditorState(null); }
                          else openEditor(bar);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-2 h-8 rounded-md border flex items-center px-2 gap-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none shadow-sm hover:shadow-md hover:brightness-105",
                              isDone
                                ? "bg-muted/60 border-border/50 text-muted-foreground line-through"
                                : isOverdue
                                ? "bg-destructive/10 border-destructive/50 text-destructive"
                                : "bg-card border-border text-card-foreground",
                              openBarId === bar.cardId && "ring-2 ring-primary"
                            )}
                            style={{ left, width: Math.max(width, 80) }}
                            aria-label={`${bar.title} — click to edit dates`}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_COLORS[bar.priority] ?? "bg-muted")} />
                            <span className="truncate">{bar.title}</span>
                            {bar.dueDate && (
                              <span className="ml-auto shrink-0 opacity-60 text-[10px] hidden sm:block">
                                {format(parseISO(bar.dueDate), "MMM d")}
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>

                        {/* Bar editor popover */}
                        <PopoverContent className="w-80 p-0" side="bottom" align="start">
                          {editorState?.cardId === bar.cardId && (
                            <div className="flex flex-col gap-0">
                              {/* Popover header */}
                              <div className="flex items-start justify-between p-4 pb-2 border-b">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm leading-snug">{editorState.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">Card #{editorState.cardId}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 -mr-1 -mt-1"
                                  onClick={() => { setSelectedCardId(editorState.cardId); setOpenBarId(null); }}
                                  title="Open full card"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </div>

                              <div className="p-4 space-y-4">
                                {/* Status */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">Status</Label>
                                  <Select
                                    value={editorState.status}
                                    onValueChange={(v) =>
                                      setEditorState((s) => s && { ...s, status: v })
                                    }
                                    disabled={!canEdit}
                                  >
                                    <SelectTrigger className="h-8 text-sm" aria-label="Status">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map((opt) => (
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

                                {/* Date pickers */}
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Start date */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Start Date</Label>
                                    <Popover
                                      open={pickingField === "start"}
                                      onOpenChange={(open) => setPickingField(open ? "start" : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full justify-start h-8 text-xs font-normal"
                                          disabled={!canEdit}
                                          aria-label="Pick start date"
                                        >
                                          <CalendarIcon className="w-3 h-3 mr-2 shrink-0 text-muted-foreground" />
                                          {editorState.startDate
                                            ? format(editorState.startDate, "MMM d, yyyy")
                                            : <span className="text-muted-foreground">None</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" side="bottom" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editorState.startDate}
                                          onSelect={(d) => {
                                            setEditorState((s) => s && { ...s, startDate: d ?? undefined });
                                            setPickingField(null);
                                          }}
                                          initialFocus
                                        />
                                        {editorState.startDate && (
                                          <div className="p-2 border-t">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="w-full h-7 text-xs text-muted-foreground"
                                              onClick={() => {
                                                setEditorState((s) => s && { ...s, startDate: undefined });
                                                setPickingField(null);
                                              }}
                                            >
                                              Clear date
                                            </Button>
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </div>

                                  {/* Due date */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Due Date</Label>
                                    <Popover
                                      open={pickingField === "due"}
                                      onOpenChange={(open) => setPickingField(open ? "due" : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full justify-start h-8 text-xs font-normal"
                                          disabled={!canEdit}
                                          aria-label="Pick due date"
                                        >
                                          <CalendarIcon className="w-3 h-3 mr-2 shrink-0 text-muted-foreground" />
                                          {editorState.dueDate
                                            ? format(editorState.dueDate, "MMM d, yyyy")
                                            : <span className="text-muted-foreground">None</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" side="bottom" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={editorState.dueDate}
                                          onSelect={(d) => {
                                            setEditorState((s) => s && { ...s, dueDate: d ?? undefined });
                                            setPickingField(null);
                                          }}
                                          fromDate={editorState.startDate}
                                          initialFocus
                                        />
                                        {editorState.dueDate && (
                                          <div className="p-2 border-t">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="w-full h-7 text-xs text-muted-foreground"
                                              onClick={() => {
                                                setEditorState((s) => s && { ...s, dueDate: undefined });
                                                setPickingField(null);
                                              }}
                                            >
                                              Clear date
                                            </Button>
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
                                <Button
                                  size="sm"
                                  className="flex-1 h-8"
                                  onClick={handleSave}
                                  disabled={editorState.saving || !canEdit}
                                >
                                  {editorState.saving ? "Saving…" : "Save Changes"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => { setOpenBarId(null); setEditorState(null); }}
                                >
                                  Cancel
                                </Button>
                              </div>

                              {!canEdit && (
                                <p className="text-xs text-muted-foreground text-center pb-3">
                                  Switch to Admin role to edit
                                </p>
                              )}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
