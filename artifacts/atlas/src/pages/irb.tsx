import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListTeams, useListMembers } from "@workspace/api-client-react";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Plus, Pencil, Trash2, AlertTriangle, Clock,
  CheckCircle2, XCircle, FileText, Info, X, Bell, Mail, Tag,
  Flag, ChevronDown, User, UserCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays, isPast } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface IrbRecord {
  id: number; teamId: number | null; protocolNumber: string | null;
  title: string; pi: string | null; piEmail: string | null;
  irbTeamMember: string | null; irbTeamMemberEmail: string | null;
  submissionType: string; status: string;
  priority: number | null;
  customLabels: string | null;
  submittedDate: string | null; approvedDate: string | null;
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
  { value: "draft",        label: "Draft",        color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { value: "submitted",    label: "Submitted",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "under_review", label: "Under Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "approved",     label: "Approved",     color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "expired",      label: "Expired",      color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  { value: "closed",       label: "Closed",       color: "bg-slate-100 text-slate-500" },
  { value: "withdrawn",    label: "Withdrawn",    color: "bg-slate-100 text-slate-500" },
];

const PRIORITIES = [
  { value: 1, label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", dot: "bg-red-500" },
  { value: 2, label: "High",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", dot: "bg-orange-500" },
  { value: 3, label: "Medium",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", dot: "bg-amber-500" },
  { value: 4, label: "Low",      color: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300", dot: "bg-sky-400" },
  { value: 5, label: "Minimal",  color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
];

function statusBadge(status: string) {
  const s = STATUSES.find(x => x.value === status);
  return s ? <Badge className={cn("text-xs px-2 py-0 font-medium", s.color)}>{s.label}</Badge>
    : <Badge variant="secondary">{status}</Badge>;
}

function priorityBadge(priority: number | null) {
  const p = PRIORITIES.find(x => x.value === (priority ?? 3));
  if (!p) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-current/10", p.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", p.dot)} />
      {p.label}
    </span>
  );
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

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const EMPTY_FORM = {
  teamId: "", protocolNumber: "", title: "", pi: "", piEmail: "",
  irbTeamMember: "", irbTeamMemberEmail: "",
  submissionType: "new_study", status: "draft", priority: "3",
  submittedDate: "", approvedDate: "", expirationDate: "", notes: "", customLabels: "[]",
};

interface EditorProps {
  open: boolean; initial: IrbRecord | null; teams: Team[];
  onClose: () => void; onSaved: () => void;
}

function IrbEditor({ open, initial, teams, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const labels = parseLabels(form.customLabels);

  React.useEffect(() => {
    if (open) {
      setForm(initial ? {
        teamId: initial.teamId ? String(initial.teamId) : "",
        protocolNumber: initial.protocolNumber ?? "",
        title: initial.title,
        pi: initial.pi ?? "",
        piEmail: initial.piEmail ?? "",
        irbTeamMember: initial.irbTeamMember ?? "",
        irbTeamMemberEmail: initial.irbTeamMemberEmail ?? "",
        submissionType: initial.submissionType,
        status: initial.status,
        priority: String(initial.priority ?? 3),
        submittedDate: initial.submittedDate ?? "",
        approvedDate: initial.approvedDate ?? "",
        expirationDate: initial.expirationDate ?? "",
        notes: initial.notes ?? "",
        customLabels: initial.customLabels ?? "[]",
      } : { ...EMPTY_FORM });
      setNewLabel("");
    }
  }, [open, initial]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addLabel = () => {
    const val = newLabel.trim();
    if (!val) return;
    const existing = parseLabels(form.customLabels);
    if (existing.includes(val)) { setNewLabel(""); return; }
    set("customLabels", JSON.stringify([...existing, val]));
    setNewLabel("");
  };

  const removeLabel = (label: string) => {
    set("customLabels", JSON.stringify(parseLabels(form.customLabels).filter(l => l !== label)));
  };

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
          <div className="px-6 py-4 space-y-5">

            {/* Core fields */}
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
                <Label className="text-xs font-semibold">Team (optional)</Label>
                <Select value={form.teamId || "__none__"} onValueChange={v => set("teamId", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No team</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* PI + IRB team member */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">People</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Principal Investigator
                  </Label>
                  <Input value={form.pi} onChange={e => set("pi", e.target.value)} placeholder="Dr. Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">PI Email (for reminders)</Label>
                  <Input type="email" value={form.piEmail} onChange={e => set("piEmail", e.target.value)} placeholder="jsmith@va.gov" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-primary" /> IRB Team Member
                  </Label>
                  <Input value={form.irbTeamMember} onChange={e => set("irbTeamMember", e.target.value)} placeholder="Compliance officer name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">IRB Member Email (for reminders)</Label>
                  <Input type="email" value={form.irbTeamMemberEmail} onChange={e => set("irbTeamMemberEmail", e.target.value)} placeholder="irb@va.gov" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Status + type + priority */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status & Priority</p>
              <div className="grid grid-cols-3 gap-4">
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
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Flag className="w-3 h-3" /> Priority
                  </Label>
                  <Select value={form.priority} onValueChange={v => set("priority", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={String(p.value)}>
                          <span className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", p.dot)} />
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Dates</p>
              <div className="grid grid-cols-3 gap-4">
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
              </div>
            </div>

            <Separator />

            {/* Custom Labels */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-primary" /> Custom Labels
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {labels.map(l => (
                  <span key={l} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 border border-primary/20">
                    {l}
                    <button type="button" onClick={() => removeLabel(l)} className="hover:text-destructive">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLabel(); }}}
                  placeholder="Type a label and press Enter…"
                  className="h-8 text-xs"
                />
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-3" onClick={addLabel} disabled={!newLabel.trim()}>
                  Add
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Conditions of approval, required reports, special stipulations…"
                rows={3} className="resize-none text-sm" />
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
  const [filterPriority, setFilterPriority] = useState("all");
  const [infoDismissed, setInfoDismissed] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);

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

  const handleSendReminder = async (r: IrbRecord) => {
    setSendingReminder(r.id);
    try {
      const expInfo = expirationInfo(r.expirationDate);
      const msg = expInfo
        ? `Protocol "${r.title}" (${r.protocolNumber ?? "no #"}): ${expInfo.label}.`
        : `Protocol "${r.title}" requires attention.`;

      await fetch(`${BASE}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          title: `IRB Reminder: ${r.title}`,
          message: msg,
          irbSubmissionId: r.id,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      const emailTargets = [
        r.piEmail && `${r.pi ?? "PI"} <${r.piEmail}>`,
        r.irbTeamMemberEmail && `${r.irbTeamMember ?? "IRB Member"} <${r.irbTeamMemberEmail}>`,
      ].filter(Boolean).join(", ");

      if (emailTargets) {
        const subject = encodeURIComponent(`IRB Reminder: ${r.title}`);
        const body = encodeURIComponent(`${msg}\n\nPlease log in to Atlas for details.`);
        const allEmails = [r.piEmail, r.irbTeamMemberEmail].filter(Boolean).join(",");
        window.open(`mailto:${allEmails}?subject=${subject}&body=${body}`, "_blank");
        toast({ title: "Reminder sent", description: `In-app notification created. Email draft opened for ${emailTargets}.` });
      } else {
        toast({ title: "Reminder logged", description: "In-app notification created. Add PI/IRB email addresses to also send email reminders." });
      }
    } catch {
      toast({ title: "Failed to send reminder", variant: "destructive" });
    } finally { setSendingReminder(null); }
  };

  const teamMap = Object.fromEntries((teams as Team[]).map(t => [t.id, t]));
  const now = new Date();

  const expiringSoon = records.filter(r => {
    if (!r.expirationDate || r.status === "expired" || r.status === "closed") return false;
    const d = differenceInDays(parseISO(r.expirationDate), now);
    return d >= 0 && d <= 60;
  });
  const expired = records.filter(r => r.status === "expired" || (r.expirationDate && isPast(parseISO(r.expirationDate)) && r.status === "approved"));
  const active = records.filter(r => r.status === "approved");

  const filtered = records.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterPriority !== "all" && String(r.priority ?? 3) !== filterPriority) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> IRB &amp; Regulatory Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track protocol submissions, approvals, renewals, and team assignments.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> New Submission</Button>
      </div>

      {/* Dismissible info banner */}
      {!infoDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Reminder emails</span> open a pre-filled email draft if PI or IRB member emails are set.
            Add email addresses in each submission to enable direct email drafting.
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
          {[{ value: "all", label: "All" }, ...STATUSES].map(s => (
            <button key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filterStatus === s.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              )}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Priority:</span>
          <button onClick={() => setFilterPriority("all")}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              filterPriority === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
            All
          </button>
          {PRIORITIES.map(p => (
            <button key={p.value}
              onClick={() => setFilterPriority(String(p.value))}
              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filterPriority === String(p.value) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
              {p.label}
            </button>
          ))}
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["P#", "Protocol #", "Title", "PI", "IRB Member", "Type", "Status", "Priority", "Expiration", "Team", "Labels", ""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const exp = expirationInfo(r.expirationDate);
                  const team = r.teamId ? teamMap[r.teamId] : null;
                  const labels = parseLabels(r.customLabels);
                  return (
                    <tr key={r.id}
                      className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors group",
                        i % 2 === 1 && "bg-muted/5")}>
                      <td className="px-3 py-3">
                        {priorityBadge(r.priority)}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {r.protocolNumber || "—"}
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <p className="font-medium truncate" title={r.title}>{r.title}</p>
                        {r.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{r.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div>
                          <p className="text-xs font-medium">{r.pi || "—"}</p>
                          {r.piEmail && (
                            <a href={`mailto:${r.piEmail}`} className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[120px] block">{r.piEmail}</a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div>
                          <p className="text-xs font-medium">{r.irbTeamMember || "—"}</p>
                          {r.irbTeamMemberEmail && (
                            <a href={`mailto:${r.irbTeamMemberEmail}`} className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[120px] block">{r.irbTeamMemberEmail}</a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          {SUBMISSION_TYPES.find(t => t.value === r.submissionType)?.label ?? r.submissionType}
                        </span>
                      </td>
                      <td className="px-3 py-3">{statusBadge(r.status)}</td>
                      <td className="px-3 py-3">{priorityBadge(r.priority)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {exp ? (
                          <span className={cn("flex items-center gap-1 text-xs", exp.color)}>
                            {exp.icon} {exp.label}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {team ? (
                          <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 max-w-[160px]">
                        {labels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {labels.map(l => (
                              <span key={l} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 border border-primary/20 whitespace-nowrap">
                                {l}
                              </span>
                            ))}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSendReminder(r)}
                            disabled={sendingReminder === r.id}
                            className="p-1.5 rounded hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-colors"
                            title="Send reminder to PI / IRB member">
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(r)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(r)}
                            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
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
