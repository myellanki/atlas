import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  BookOpen, Plus, Pencil, Trash2, ExternalLink,
  Filter, Link2, CheckCircle2, Send, FileText, Presentation,
  Wrench, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TYPES = [
  { value: "paper",      label: "Journal Paper",     icon: <BookOpen className="w-3.5 h-3.5" />,    color: "#6366f1" },
  { value: "report",     label: "Report",            icon: <FileText className="w-3.5 h-3.5" />,    color: "#0ea5e9" },
  { value: "conference", label: "Conference",        icon: <Presentation className="w-3.5 h-3.5" />, color: "#8b5cf6" },
  { value: "product",    label: "Operational Product", icon: <Wrench className="w-3.5 h-3.5" />,   color: "#10b981" },
];

const STATUSES = [
  { value: "drafting",   label: "Drafting",   color: "#94a3b8", icon: <FileText className="w-3 h-3" /> },
  { value: "submitted",  label: "Submitted",  color: "#f59e0b", icon: <Send className="w-3 h-3" /> },
  { value: "accepted",   label: "Accepted",   color: "#3b82f6", icon: <CheckCircle2 className="w-3 h-3" /> },
  { value: "published",  label: "Published",  color: "#22c55e", icon: <CheckCircle2 className="w-3 h-3" /> },
];

interface Deliverable {
  id: number;
  cardId: number;
  title: string;
  type: string;
  targetDate: string | null;
  status: string;
  journal: string | null;
  firstAuthor: string | null;
  doi: string | null;
  url: string | null;
  notes: string | null;
  publishedYear: number | null;
  createdAt: string;
  updatedAt: string;
  cardTitle: string | null;
  teamId: number | null;
}

const BLANK = {
  title: "", type: "paper", targetDate: "", status: "drafting",
  journal: "", firstAuthor: "", doi: "", url: "", notes: "", publishedYear: "",
};

function typeConf(type: string) {
  return TYPES.find(t => t.value === type) ?? TYPES[0];
}
function statusConf(status: string) {
  return STATUSES.find(s => s.value === status) ?? STATUSES[0];
}

function groupByYear(items: Deliverable[]): [string, Deliverable[]][] {
  const map = new Map<string, Deliverable[]>();
  items.forEach(item => {
    const key = item.publishedYear ? String(item.publishedYear) : "Pending";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === "Pending") return 1;
    if (b[0] === "Pending") return -1;
    return parseInt(b[0]) - parseInt(a[0]);
  });
}

export default function PublicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deliverable | null>(null);
  const [form, setForm] = useState<typeof BLANK>(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());

  const { data: allItems = [], isLoading } = useQuery<Deliverable[]>({
    queryKey: ["publications"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/publications`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const years = useMemo(() => {
    const ys = new Set(allItems.map(d => d.publishedYear ? String(d.publishedYear) : "Pending"));
    return Array.from(ys).sort((a, b) => {
      if (a === "Pending") return 1;
      if (b === "Pending") return -1;
      return parseInt(b) - parseInt(a);
    });
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter(d => {
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterYear !== "all") {
        const yr = d.publishedYear ? String(d.publishedYear) : "Pending";
        if (yr !== filterYear) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.firstAuthor?.toLowerCase().includes(q) ||
          d.journal?.toLowerCase().includes(q) ||
          d.cardTitle?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allItems, filterStatus, filterType, filterYear, searchQuery]);

  const groups = groupByYear(filtered);

  const stats = useMemo(() => ({
    total: allItems.length,
    published: allItems.filter(d => d.status === "published").length,
    submitted: allItems.filter(d => d.status === "submitted").length,
    accepted: allItems.filter(d => d.status === "accepted").length,
    drafting: allItems.filter(d => d.status === "drafting").length,
  }), [allItems]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setShowForm(true);
  };

  const openEdit = (item: Deliverable) => {
    setEditing(item);
    setForm({
      title: item.title,
      type: item.type,
      targetDate: item.targetDate ?? "",
      status: item.status,
      journal: item.journal ?? "",
      firstAuthor: item.firstAuthor ?? "",
      doi: item.doi ?? "",
      url: item.url ?? "",
      notes: item.notes ?? "",
      publishedYear: item.publishedYear ? String(item.publishedYear) : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload = {
      title: form.title,
      type: form.type,
      targetDate: form.targetDate || null,
      status: form.status,
      journal: form.journal || null,
      firstAuthor: form.firstAuthor || null,
      doi: form.doi || null,
      url: form.url || null,
      notes: form.notes || null,
      publishedYear: form.publishedYear ? parseInt(String(form.publishedYear)) : null,
    };
    try {
      if (editing) {
        await fetch(`${BASE}/api/deliverables/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Standalone publication — use cardId=0 sentinel not possible; we need a real card
        // For standalone entries, we'll use a special "publications" endpoint
        // Actually we need a cardId. Let's just alert the user that they need to link to a card
        // OR we can create a "publications" table - but for now let's support it via a dummy card
        // Actually the simplest approach: require linking to a card, OR we handle this differently
        // Let me use the deliverables table with the card being optional by having a special value
        // Since cardId is NOT NULL, standalone publications need a card. Let's skip for now 
        // and only support editing existing deliverables that were created via card.
        // For the publications dashboard we show all deliverables.
        // For CREATING new publications standalone, we need a different approach.
        // Let me instead create a publications-only endpoint in the API.
        // For now, show a toast directing to create via card detail.
        toast({
          title: "To add a new publication, open a card and add it via the Deliverables section.",
          variant: "destructive"
        });
        setSaving(false);
        setShowForm(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["publications"] });
      setShowForm(false);
      toast({ title: editing ? "Publication updated" : "Publication added" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${BASE}/api/deliverables/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["publications"] });
    setDeleteId(null);
    toast({ title: "Publication removed" });
  };

  const toggleYear = (yr: string) => setCollapsedYears(prev => {
    const next = new Set(prev);
    next.has(yr) ? next.delete(yr) : next.add(yr);
    return next;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Publications Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All manuscripts, reports, and conference papers — organized by year. Publications are linked to research cards.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Publication
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Published", value: stats.published, color: "text-green-600" },
          { label: "Accepted", value: stats.accepted, color: "text-blue-600" },
          { label: "Submitted", value: stats.submitted, color: "text-amber-600" },
          { label: "Drafting", value: stats.drafting, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search title, author, journal…"
            className="h-8 text-sm pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-1">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No publications found.</p>
          <p className="text-xs mt-1">Publications are created via the Deliverables section on individual cards.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([year, items]) => (
            <div key={year}>
              <button
                className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toggleYear(year)}
              >
                {collapsedYears.has(year)
                  ? <span className="text-xs">▶</span>
                  : <span className="text-xs">▼</span>
                }
                <span className="text-lg font-bold text-foreground">{year}</span>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </button>

              {!collapsedYears.has(year) && (
                <div className="space-y-2">
                  {items.map(item => {
                    const tc = typeConf(item.type);
                    const sc = statusConf(item.status);
                    return (
                      <div key={item.id}
                        className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-muted/10 transition-colors group">
                        {/* Type icon */}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                          style={{ backgroundColor: tc.color }}>
                          {tc.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="font-semibold text-sm leading-snug">{item.title}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0"
                              style={{ borderColor: sc.color, color: sc.color }}>
                              <span className="mr-1">{sc.icon}</span>{sc.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {item.firstAuthor && <span className="font-medium">{item.firstAuthor}</span>}
                            {item.journal && <span className="italic">{item.journal}</span>}
                            {item.targetDate && (
                              <span>Target: {format(parseISO(item.targetDate), "MMM yyyy")}</span>
                            )}
                            {item.cardTitle && (
                              <span className="flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                <span className="text-primary">{item.cardTitle}</span>
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">
                              {item.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.doi && (
                              <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> DOI: {item.doi}
                              </a>
                            )}
                            {item.url && !item.doi && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Link
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => openEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {editing ? "Edit Publication" : "Add Publication"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Full publication title" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Author</Label>
                <Input value={form.firstAuthor} onChange={e => setForm(f => ({ ...f, firstAuthor: e.target.value }))}
                  placeholder="Last, First" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Journal / Venue</Label>
                <Input value={form.journal} onChange={e => setForm(f => ({ ...f, journal: e.target.value }))}
                  placeholder="e.g. JAMA, Cancer" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Published Year</Label>
                <Input type="number" value={form.publishedYear}
                  onChange={e => setForm(f => ({ ...f, publishedYear: e.target.value }))}
                  placeholder="e.g. 2024" className="h-8 text-sm" min="2000" max="2035" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target / Submission Date</Label>
                <Input type="date" value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                  className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">DOI</Label>
                <Input value={form.doi} onChange={e => setForm(f => ({ ...f, doi: e.target.value }))}
                  placeholder="10.xxxx/xxxxx" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://…" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional context…" className="h-16 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Remove Publication
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This removes the publication from the dashboard. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
