import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListTeams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays, addMonths, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import {
  Diamond, Plus, Pencil, Trash2, CalendarDays, Flag, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const MILESTONE_TYPES = [
  { value: "irb_submission",  label: "IRB Submission",       color: "#8b5cf6" },
  { value: "data_access",     label: "Data Access Approved", color: "#0ea5e9" },
  { value: "eda_complete",    label: "EDA Complete",         color: "#10b981" },
  { value: "manuscript",      label: "Manuscript Submitted", color: "#f59e0b" },
  { value: "dissemination",   label: "Dissemination",        color: "#ec4899" },
  { value: "general",         label: "General",              color: "#6366f1" },
];

const typeConfig = Object.fromEntries(MILESTONE_TYPES.map(t => [t.value, t]));

interface Milestone {
  id: number;
  teamId: number;
  name: string;
  date: string;
  type: string;
  color: string;
  description: string | null;
  cardId: number | null;
  createdAt: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

const EMPTY_FORM = { name: "", date: "", type: "general", color: "#f59e0b", description: "" };

export default function MilestonesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading: loadingTeams } = useListTeams();

  const [filterTeamId, setFilterTeamId] = useState<number | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: allMilestones = [], isLoading: loadingMs } = useQuery<Milestone[]>({
    queryKey: ["milestones"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/milestones`);
      return r.json();
    },
  });

  const milestones = useMemo(() => {
    if (filterTeamId === "all") return allMilestones;
    return allMilestones.filter(m => m.teamId === filterTeamId);
  }, [allMilestones, filterTeamId]);

  const sorted = useMemo(() =>
    [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones]
  );

  const teamMap = useMemo(() =>
    Object.fromEntries((teams as Team[]).map(t => [t.id, t])),
    [teams]
  );

  const openCreate = (teamId?: number) => {
    setEditing(null);
    const t = MILESTONE_TYPES[5];
    setForm({ ...EMPTY_FORM, color: t.color, ...(teamId ? {} : {}) });
    setShowForm(true);
  };

  const openEdit = (m: Milestone) => {
    setEditing(m);
    setForm({ name: m.name, date: m.date, type: m.type, color: m.color, description: m.description ?? "" });
    setShowForm(true);
  };

  const handleTypeChange = (v: string) => {
    const c = typeConfig[v]?.color ?? "#6366f1";
    setForm(f => ({ ...f, type: v, color: c }));
  };

  const handleSave = async () => {
    if (!form.name || !form.date) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`${BASE}/api/milestones/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        const teamId = filterTeamId !== "all" ? filterTeamId : (teams as Team[])[0]?.id;
        if (!teamId) { toast({ title: "Select a team first", variant: "destructive" }); setSaving(false); return; }
        await fetch(`${BASE}/api/teams/${teamId}/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${BASE}/api/milestones/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["milestones"] });
    setDeleteId(null);
  };

  // ── Timeline ──────────────────────────────────────────────────────────────
  const today = new Date();
  const timelineStart = useMemo(() => {
    if (sorted.length === 0) return subMonths(today, 2);
    const earliest = parseISO(sorted[0].date);
    return subMonths(earliest < today ? earliest : today, 1);
  }, [sorted]);
  const timelineEnd = useMemo(() => {
    if (sorted.length === 0) return addMonths(today, 6);
    const latest = parseISO(sorted[sorted.length - 1].date);
    return addMonths(latest > today ? latest : today, 2);
  }, [sorted]);

  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const PX_PER_DAY = 3;
  const canvasW = totalDays * PX_PER_DAY;

  const dateToX = (d: Date) => differenceInDays(d, timelineStart) * PX_PER_DAY;
  const todayX = dateToX(today);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-amber-500" />
            Project Milestones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pin named milestones to specific research deadlines — IRB, data access, manuscripts, dissemination.
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="w-4 h-4" /> Add Milestone
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Team</Label>
        <Select value={String(filterTeamId)} onValueChange={v => setFilterTeamId(v === "all" ? "all" : parseInt(v))}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {(teams as Team[]).map(t => (
              <SelectItem key={t.id} value={String(t.id)}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">{sorted.length} milestone{sorted.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Timeline */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="px-4 py-3 border-b bg-muted/20 text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> Timeline View
        </div>
        <div className="overflow-x-auto">
          <div style={{ width: Math.max(canvasW, 800), position: "relative" }}>
            {/* Month header */}
            <div className="h-8 bg-muted/30 border-b flex" style={{ width: canvasW }}>
              {months.map(m => {
                const x = dateToX(m);
                const daysInMonth = differenceInDays(
                  endOfMonth(m),
                  m < timelineStart ? timelineStart : m
                ) + 1;
                return (
                  <div key={m.toISOString()}
                    className="absolute top-0 h-full border-l border-border/40 flex items-center pl-2"
                    style={{ left: x, width: daysInMonth * PX_PER_DAY }}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                      {format(m, "MMM yyyy")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Diamond row */}
            <div className="h-16 relative" style={{ width: canvasW }}>
              {/* Today line */}
              {todayX >= 0 && todayX <= canvasW && (
                <div className="absolute top-0 bottom-0 border-l border-red-400/70 border-dashed z-20"
                  style={{ left: todayX }} />
              )}

              {sorted.map(m => {
                const x = dateToX(parseISO(m.date));
                const isPast = parseISO(m.date) < today;
                return (
                  <div key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group cursor-pointer"
                    style={{ left: x }}
                    title={`${m.name} — ${format(parseISO(m.date), "MMM d, yyyy")}`}
                    onClick={() => openEdit(m)}
                  >
                    {/* Diamond SVG */}
                    <svg width="20" height="20" viewBox="0 0 20 20"
                      className="drop-shadow group-hover:scale-125 transition-transform">
                      <polygon
                        points="10,1 19,10 10,19 1,10"
                        fill={m.color}
                        opacity={isPast ? 0.6 : 1}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {/* Label below */}
                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                      text-[9px] font-semibold px-1 rounded pointer-events-none"
                      style={{ color: m.color }}
                    >
                      {m.name.length > 14 ? m.name.slice(0, 12) + "…" : m.name}
                    </div>
                  </div>
                );
              })}

              {sorted.length === 0 && !loadingMs && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  No milestones yet — add one to see it here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {MILESTONE_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon points="6,0 12,6 6,12 0,6" fill={t.color} />
            </svg>
            {t.label}
          </div>
        ))}
      </div>

      {/* Milestone list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">All Milestones</h2>
        {loadingMs ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Diamond className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No milestones found. Add your first research milestone above.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sorted.map(m => {
              const daysAway = differenceInDays(parseISO(m.date), today);
              const isPast = daysAway < 0;
              const isClose = !isPast && daysAway <= 14;
              const tc = typeConfig[m.type];
              const team = teamMap[m.teamId];
              return (
                <div key={m.id}
                  className="flex items-center gap-4 p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-colors group">
                  {/* Diamond */}
                  <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
                    <polygon points="12,1 23,12 12,23 1,12"
                      fill={m.color} opacity={isPast ? 0.5 : 1}
                      stroke="white" strokeWidth="1.5" />
                  </svg>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("font-semibold text-sm", isPast && "line-through text-muted-foreground")}>
                        {m.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0"
                        style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                        {tc?.label ?? m.type}
                      </Badge>
                      {team && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className={cn(
                      "text-sm font-semibold",
                      isPast ? "text-muted-foreground" : isClose ? "text-destructive" : "text-foreground"
                    )}>
                      {format(parseISO(m.date), "MMM d, yyyy")}
                    </div>
                    <div className={cn(
                      "text-[11px] mt-0.5",
                      isPast ? "text-muted-foreground" : isClose ? "text-destructive font-medium" : "text-muted-foreground"
                    )}>
                      {isPast
                        ? `${Math.abs(daysAway)}d ago`
                        : daysAway === 0
                        ? "Today!"
                        : `in ${daysAway}d`
                      }
                      {isClose && !isPast && <AlertCircle className="inline w-3 h-3 ml-1" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Diamond className="w-4 h-4 text-amber-500" />
              {editing ? "Edit Milestone" : "Add Milestone"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-1.5">
                <Label className="text-xs">Team <span className="text-destructive">*</span></Label>
                <Select value={filterTeamId !== "all" ? String(filterTeamId) : String((teams as Team[])[0]?.id ?? "")}
                  onValueChange={v => setFilterTeamId(parseInt(v))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(teams as Team[]).map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. IRB protocol submitted" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MILESTONE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <polygon points="5,0 10,5 5,10 0,5" fill={t.color} />
                          </svg>
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Any context or notes about this milestone…"
                className="h-16 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.date}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Delete Milestone
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This will permanently remove this milestone. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
