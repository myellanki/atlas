import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListTeams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Plus, Pencil, Trash2, AlertTriangle, Clock,
  CheckCircle2, XCircle, FileText, Info, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays, isPast } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface IrbRecord {
  id: number; teamId: number | null; protocolNumber: string | null;
  title: string; pi: string | null; submissionType: string;
  status: string; submittedDate: string | null; approvedDate: string | null;
  expirationDate: string | null; notes: string | null; createdAt: string;
}
interface Team { id: number; name: string; color: string; }

const SUBMISSION_TYPES = [
  { value: "new_study",    label: "New Study" },
  { value: "renewal",      label: "Renewal" },
  { value: "amendment",    label: "Amendment / Modification" },
  { value: "closure",      label: "Study Closure" },
  { value: "exempt",       label: "Exempt Determination" },
];

const STATUSES = [
  { value: "draft",        label: "Draft",        color: "bg-slate-100 text-slate-600" },
  { value: "submitted",    label: "Submitted",    color: "bg-blue-100 text-blue-700" },
  { value: "under_review", label: "Under Review", color: "bg-amber-100 text-amber-700" },
  { value: "approved",     label: "Approved",     color: "bg-green-100 text-green-700" },
  { value: "expired",      label: "Expired",      color: "bg-red-100 text-red-700" },
  { value: "closed",       label: "Closed",       color: "bg-slate-100 text-slate-500" },
  { value: "withdrawn",    label: "Withdrawn",    color: "bg-slate-100 text-slate-500" },
];

function statusBadge(status: string) {
  const s = STATUSES.find(x => x.value === status);
  return s ? (
    <Badge className={cn("text-xs px-2 py-0", s.color)}>{s.label}</Badge>
  ) : <Badge variant="secondary">{status}</Badge>;
}

function expirationInfo(date: string | null) {
  if (!date) return null;
  const d = parseISO(date);
  const days = differenceInDays(d, new Date());
  const past = isPast(d);
  if (past) return { label: `Expired ${Math.abs(days)}d ago`, color: "text-destructive", icon: <XCircle className="w-3.5 h-3.5" /> };
  if (days <= 30) return { label: `Expires in ${days}d`, color: "text-destructive", icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  if (days <= 60) return { label: `Expires in ${days}d`, color: "text-amber-600", icon: <Clock className="w-3.5 h-3.5" /> };
  return { label: format(d, "MMM d, yyyy"), color: "text-muted-foreground", icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> };
}

const EMPTY_FORM = {
  teamId: "", protocolNumber: "", title: "", pi: "",
  submissionType: "new_study", status: "draft",
  submittedDate: "", approvedDate: "", expirationDate: "", notes: "",
};

interface EditorProps {
  open: boolean; initial: IrbRecord | null; teams: Team[];
  onClose: () => void; onSaved: () => void;
}

function IrbEditor({ open, initial, teams, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(initial ? {
        teamId: initial.teamId ? String(initial.teamId) : "",
        protocolNumber: initial.protocolNumber ?? "",
        title: initial.title,
        pi: initial.pi ?? "",
        submissionType: initial.submissionType,
        status: initial.status,
        submittedDate: initial.submittedDate ?? "",
        approvedDate: initial.approvedDate ?? "",
        expirationDate: initial.expirationDate ?? "",
        notes: initial.notes ?? "",
      } : { ...EMPTY_FORM });
    }
  }, [open, initial]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = initial ? `${BASE}/api/irb/${initial.id}` : `${BASE}/api/irb`;
      const method = initial ? "PATCH" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      onSaved(); onClose();
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {initial ? "Edit IRB Submission" : "New IRB Submission"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Study / Protocol Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Risk of Bladder Cancer in Gulf War Veterans" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Protocol Number</Label>
                <Input value={form.protocolNumber} onChange={e => set("protocolNumber", e.target.value)} placeholder="e.g. IRB-2024-00123" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Principal Investigator</Label>
                <Input value={form.pi} onChange={e => set("pi", e.target.value)} placeholder="e.g. Dr. Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Submission Type</Label>
                <Select value={form.submissionType} onValueChange={v => set("submissionType", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Team (optional)</Label>
                <Select value={form.teamId || "__none__"} onValueChange={v => set("teamId", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No team</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date Submitted</Label>
                <Input type="date" value={form.submittedDate} onChange={e => set("submittedDate", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date Approved</Label>
                <Input type="date" value={form.approvedDate} onChange={e => set("approvedDate", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expiration / Renewal Date</Label>
                <Input type="date" value={form.expirationDate} onChange={e => set("expirationDate", e.target.value)} className="h-9" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                  placeholder="Conditions of approval, required reports, special stipulations…"
                  rows={3} className="resize-none text-sm" />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Submission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function IrbPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: teams = [] } = useListTeams();

  const { data: records = [], isLoading } = useQuery<IrbRecord[]>({
    queryKey: ["irb"],
    queryFn: async () => { const r = await fetch(`${BASE}/api/irb`); return r.json(); },
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IrbRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IrbRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [infoDismissed, setInfoDismissed] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["irb"] });

  const openCreate = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (r: IrbRecord) => { setEditTarget(r); setEditorOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`${BASE}/api/irb/${deleteTarget.id}`, { method: "DELETE" });
    refresh();
    toast({ title: `Deleted "${deleteTarget.title}"` });
    setDeleteTarget(null);
  };

  const teamMap = Object.fromEntries((teams as Team[]).map(t => [t.id, t]));

  // Summary stats
  const now = new Date();
  const expiringSoon = records.filter(r => {
    if (!r.expirationDate || r.status === "expired" || r.status === "closed") return false;
    const d = differenceInDays(parseISO(r.expirationDate), now);
    return d >= 0 && d <= 60;
  });
  const expired = records.filter(r => r.status === "expired" || (r.expirationDate && isPast(parseISO(r.expirationDate)) && r.status === "approved"));
  const active = records.filter(r => r.status === "approved");

  const filtered = filterStatus === "all" ? records : records.filter(r => r.status === filterStatus);

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> IRB &amp; Regulatory Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track protocol submissions, approvals, and renewal deadlines across all studies.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> New Submission</Button>
      </div>

      {/* Dismissible info banner */}
      {!infoDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Optional module.</span> If your team doesn't use this section, it can be removed from the sidebar via the settings or by asking your administrator. It has no impact on any other part of the platform.
          </div>
          <button onClick={() => setInfoDismissed(true)} className="shrink-0 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Submissions", value: records.length, color: "text-foreground", bg: "bg-muted/40" },
          { label: "Approved / Active", value: active.length, color: "text-green-700", bg: "bg-green-50 dark:bg-green-950/20" },
          { label: "Expiring ≤ 60 Days", value: expiringSoon.length, color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { label: "Expired", value: expired.length, color: "text-destructive", bg: "bg-red-50 dark:bg-red-950/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border p-4", s.bg)}>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {[{ value: "all", label: "All" }, ...STATUSES].map(s => (
          <button key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              filterStatus === s.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-card">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No submissions found.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Add first submission
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Protocol #", "Title", "PI", "Type", "Status", "Expiration", "Team", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const exp = expirationInfo(r.expirationDate);
                const team = r.teamId ? teamMap[r.teamId] : null;
                return (
                  <tr key={r.id}
                    className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors group",
                      i % 2 === 1 && "bg-muted/5")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {r.protocolNumber || "—"}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate" title={r.title}>{r.title}</p>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.pi || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground">
                        {SUBMISSION_TYPES.find(t => t.value === r.submissionType)?.label ?? r.submissionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {exp ? (
                        <span className={cn("flex items-center gap-1 text-xs", exp.color)}>
                          {exp.icon} {exp.label}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {team ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <IrbEditor open={editorOpen} initial={editTarget} teams={teams as Team[]}
        onClose={() => setEditorOpen(false)} onSaved={refresh} />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed from the tracker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
