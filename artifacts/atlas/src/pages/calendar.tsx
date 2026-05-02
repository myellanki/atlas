import React, { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, format,
  addMonths, subMonths, isToday, parseISO
} from "date-fns";
import { useListCards, useListMembers, useListTeams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Layers, Circle, X
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESET_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface CustomEvent {
  id: string;
  title: string;
  date: string;
  color: string;
  description?: string;
}

const LS_KEY = "atlas_calendar_custom_events";

function loadCustomEvents(): CustomEvent[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}
function saveCustomEvents(events: CustomEvent[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(events));
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>(loadCustomEvents);
  const [showDialog, setShowDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newDescription, setNewDescription] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { setSelectedCardId } = useAppStore();
  const { toast } = useToast();

  const { data: allCards } = useListCards({});
  const { data: allMembers } = useListMembers();
  const { data: allTeams } = useListTeams();

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Map card due dates to events
  const cardEvents = useMemo(() => {
    if (!allCards) return {};
    const map: Record<string, Array<{
      type: "card";
      cardId: number;
      title: string;
      assigneeName: string;
      teamColor: string;
      status: string;
    }>> = {};
    for (const card of allCards) {
      if (!card.dueDate) continue;
      const key = format(parseISO(card.dueDate), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      const member = allMembers?.find(m => m.id === card.assigneeId);
      const team = allTeams?.find(t => t.id === card.teamId);
      map[key].push({
        type: "card",
        cardId: card.id,
        title: card.title,
        assigneeName: member?.name ?? "Unassigned",
        teamColor: team?.color ?? "#6366f1",
        status: card.status,
      });
    }
    return map;
  }, [allCards, allMembers, allTeams]);

  // Map custom events to date keys
  const customByDay = useMemo(() => {
    const map: Record<string, CustomEvent[]> = {};
    for (const ev of customEvents) {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [customEvents]);

  // All events on selected day
  const dayCardEvents = selectedDay ? (cardEvents[format(selectedDay, "yyyy-MM-dd")] ?? []) : [];
  const dayCustomEvents = selectedDay ? (customByDay[format(selectedDay, "yyyy-MM-dd")] ?? []) : [];
  const hasDayEvents = dayCardEvents.length > 0 || dayCustomEvents.length > 0;

  const openDialog = (date?: Date) => {
    setNewDate(date ?? new Date());
    setNewTitle("");
    setNewColor(PRESET_COLORS[0]);
    setNewDescription("");
    setShowDialog(true);
  };

  const handleAddEvent = () => {
    if (!newTitle.trim() || !newDate) {
      toast({ title: "Title and date required", variant: "destructive" });
      return;
    }
    const ev: CustomEvent = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      date: format(newDate, "yyyy-MM-dd"),
      color: newColor,
      description: newDescription.trim() || undefined,
    };
    const updated = [...customEvents, ev];
    setCustomEvents(updated);
    saveCustomEvents(updated);
    setShowDialog(false);
    toast({ title: "Event added" });
  };

  const handleDeleteCustom = (id: string) => {
    const updated = customEvents.filter(e => e.id !== id);
    setCustomEvents(updated);
    saveCustomEvents(updated);
  };

  const STATUS_DOT: Record<string, string> = {
    not_started: "bg-slate-400",
    in_progress: "bg-primary",
    blocked: "bg-destructive",
    in_review: "bg-purple-500",
    done: "bg-green-500",
  };

  return (
    <div className="flex h-full bg-background">
      {/* Calendar main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold min-w-[180px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </h1>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 text-xs">
              Today
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Card due date
              </span>
              <span className="flex items-center gap-1.5">
                <Circle className="w-3.5 h-3.5 fill-current text-primary/40" style={{ color: PRESET_COLORS[1] }} /> Custom event
              </span>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => openDialog()}>
              <Plus className="w-3.5 h-3.5" /> Add Event
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <div className="grid grid-cols-7 border-l border-t rounded-lg overflow-hidden">
            {days.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const dayCards = cardEvents[key] ?? [];
              const dayCustom = customByDay[key] ?? [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDay = isToday(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date("1970-01-01")) ? null : day)}
                  className={cn(
                    "border-r border-b min-h-[120px] p-1.5 cursor-pointer transition-colors",
                    !isCurrentMonth && "bg-muted/30",
                    isCurrentMonth && "bg-background hover:bg-accent/30",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isCurrentMonth && "text-foreground",
                      isTodayDay && "bg-primary text-primary-foreground font-bold",
                    )}>
                      {format(day, "d")}
                    </span>
                    {(dayCards.length > 0 || dayCustom.length > 0) && (
                      <button
                        className="text-primary opacity-0 hover:opacity-100 group-hover:opacity-100 p-0.5 rounded"
                        onClick={e => { e.stopPropagation(); openDialog(day); }}
                      >
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {/* Card events */}
                    {dayCards.slice(0, 3).map(ev => (
                      <button
                        key={ev.cardId}
                        onClick={e => { e.stopPropagation(); setSelectedCardId(ev.cardId); }}
                        className="w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] leading-tight hover:brightness-95 transition-colors font-medium truncate group"
                        style={{ backgroundColor: ev.teamColor + "22", color: ev.teamColor }}
                        title={`${ev.title} — ${ev.assigneeName}`}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: ev.teamColor }}
                        />
                        <span className="truncate">{ev.title}</span>
                      </button>
                    ))}
                    {dayCards.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1.5">
                        +{dayCards.length - 3} more card{dayCards.length - 3 !== 1 ? "s" : ""}
                      </div>
                    )}

                    {/* Custom events */}
                    {dayCustom.slice(0, 2).map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] leading-tight font-medium truncate"
                        style={{ backgroundColor: ev.color + "22", color: ev.color }}
                        title={ev.title}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side panel — shows events for selected day */}
      {selectedDay && (
        <div className="w-80 border-l bg-card flex flex-col shrink-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {format(selectedDay, "EEEE")}
              </p>
              <h2 className="text-lg font-bold">{format(selectedDay, "MMMM d, yyyy")}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(selectedDay)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!hasDayEvents && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No events on this day.</p>
                <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => openDialog(selectedDay)}>
                  <Plus className="w-3 h-3" /> Add Event
                </Button>
              </div>
            )}

            {/* Card due dates */}
            {dayCardEvents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" /> Card Due Dates ({dayCardEvents.length})
                </p>
                <div className="space-y-2">
                  {dayCardEvents.map(ev => (
                    <button
                      key={ev.cardId}
                      onClick={() => setSelectedCardId(ev.cardId)}
                      className="w-full text-left p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: ev.teamColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate group-hover:text-primary transition-colors">
                            {ev.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              STATUS_DOT[ev.status]
                                ? `bg-current/20 text-current`
                                : "bg-muted text-muted-foreground"
                            )} style={{
                              backgroundColor: ev.status === "done" ? "#dcfce7" :
                                ev.status === "blocked" ? "#fee2e2" :
                                  ev.status === "in_progress" ? "#e0e7ff" :
                                    ev.status === "in_review" ? "#f3e8ff" : "#f1f5f9",
                              color: ev.status === "done" ? "#15803d" :
                                ev.status === "blocked" ? "#dc2626" :
                                  ev.status === "in_progress" ? "#4f46e5" :
                                    ev.status === "in_review" ? "#7c3aed" : "#475569",
                            }}>
                              {ev.status.replace("_", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {ev.assigneeName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom events */}
            {dayCustomEvents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Custom Events ({dayCustomEvents.length})
                </p>
                <div className="space-y-2">
                  {dayCustomEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg border group relative"
                      style={{ borderColor: ev.color + "44" }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: ev.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ev.title}</p>
                          {ev.description && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ev.description}</p>
                          )}
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded"
                          onClick={() => handleDeleteCustom(ev.id)}
                          aria-label="Delete event"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Custom Event Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Add Custom Event
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ev-title"
                placeholder="Event title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleAddEvent()}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newDate && "text-muted-foreground")}>
                    <CalendarDays className="w-4 h-4 mr-2" />
                    {newDate ? format(newDate, "MMMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={newDate} onSelect={setNewDate} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform hover:scale-110",
                      newColor === c && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">
                Description <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="ev-desc"
                placeholder="Optional notes..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleAddEvent} disabled={!newTitle.trim() || !newDate}>
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardDetailDrawer />
    </div>
  );
}
