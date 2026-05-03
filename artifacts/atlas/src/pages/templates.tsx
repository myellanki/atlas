import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCards, useListTeams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  BookOpen, GitBranch, Beaker, FileText, CheckSquare,
  Plus, ClipboardList, ChevronDown, ChevronRight, Zap,
  Pencil, Trash2, X, GripVertical, ArrowUp, ArrowDown,
  FlaskConical, BarChart2, Microscope, Database, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { value: "ClipboardList", label: "Clipboard",  el: <ClipboardList className="w-5 h-5" /> },
  { value: "Beaker",        label: "Beaker",     el: <Beaker className="w-5 h-5" /> },
  { value: "FlaskConical",  label: "Flask",      el: <FlaskConical className="w-5 h-5" /> },
  { value: "Microscope",    label: "Microscope", el: <Microscope className="w-5 h-5" /> },
  { value: "GitBranch",     label: "Pipeline",   el: <GitBranch className="w-5 h-5" /> },
  { value: "Database",      label: "Database",   el: <Database className="w-5 h-5" /> },
  { value: "Zap",           label: "Sprint",     el: <Zap className="w-5 h-5" /> },
  { value: "FileText",      label: "Document",   el: <FileText className="w-5 h-5" /> },
  { value: "BookOpen",      label: "Book",       el: <BookOpen className="w-5 h-5" /> },
  { value: "BarChart2",     label: "Analytics",  el: <BarChart2 className="w-5 h-5" /> },
  { value: "Layers",        label: "Layers",     el: <Layers className="w-5 h-5" /> },
];

function renderIcon(name: string, className = "w-5 h-5") {
  const found = ICON_OPTIONS.find(o => o.value === name);
  if (found) {
    return React.cloneElement(found.el, { className });
  }
  return <ClipboardList className={className} />;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLOR_OPTIONS = [
  "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#f97316", "#6366f1",
  "#14b8a6", "#84cc16", "#64748b", "#1d4ed8",
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface TemplateItem { id: number; templateId: number; text: string; position: number; }
interface Template {
  id: number; name: string; description: string | null;
  color: string; icon: string; position: number; items: TemplateItem[];
}
interface Card   { id: number; title: string; teamId: number; status: string; }
interface Team   { id: number; name: string; color: string; }

// ── Template editor dialog ────────────────────────────────────────────────────
interface EditorProps {
  open: boolean;
  initial: Template | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}

function TemplateEditor({ open, initial, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const isEdit = !!initial;

  const [name, setName]           = useState(initial?.name ?? "");
  const [desc, setDesc]           = useState(initial?.description ?? "");
  const [color, setColor]         = useState(initial?.color ?? "#8b5cf6");
  const [icon, setIcon]           = useState(initial?.icon ?? "ClipboardList");
  const [items, setItems]         = useState<string[]>(initial?.items.map(i => i.text) ?? []);
  const [newItem, setNewItem]     = useState("");
  const [saving, setSaving]       = useState(false);
  const newItemRef = useRef<HTMLInputElement>(null);

  // reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDesc(initial?.description ?? "");
      setColor(initial?.color ?? "#8b5cf6");
      setIcon(initial?.icon ?? "ClipboardList");
      setItems(initial?.items.map(i => i.text) ?? []);
      setNewItem("");
    }
  }, [open, initial]);

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    setItems(prev => [...prev, t]);
    setNewItem("");
    setTimeout(() => newItemRef.current?.focus(), 30);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems(prev => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return next;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const updateItem = (idx: number, val: string) => {
    setItems(prev => prev.map((t, i) => (i === idx ? val : t)));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    const body = { name: name.trim(), description: desc.trim() || null, color, icon, items: items.filter(Boolean) };
    try {
      const url  = isEdit ? `${BASE}/api/templates/${initial!.id}` : `${BASE}/api/templates`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      onSaved();
      onClose();
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: color }}>
              {renderIcon(icon, "w-4 h-4")}
            </div>
            {isEdit ? `Edit "${initial!.name}"` : "New Template"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Name <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Grant Proposal Checklist" className="h-9" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Briefly describe when to use this template…"
                className="resize-none text-sm" rows={2} />
            </div>

            {/* Color + Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Colour</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all",
                        color === c ? "border-foreground scale-110 shadow" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Icon</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setIcon(o.value)}
                      title={o.label}
                      className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                        icon === o.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground"
                      )}>
                      {o.el}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Checklist items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Checklist Items
                  <span className="ml-2 font-normal text-muted-foreground">({items.length})</span>
                </Label>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No items yet — add one below.
                  </p>
                )}
                {items.map((text, idx) => (
                  <div key={idx}
                    className="flex items-center gap-1.5 group rounded-lg border bg-card px-2 py-1.5 hover:bg-muted/20">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    <span className="w-5 h-5 flex items-center justify-center shrink-0
                      text-[10px] text-muted-foreground font-mono">{idx + 1}</span>
                    <Input
                      value={text}
                      onChange={e => updateItem(idx, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); newItemRef.current?.focus(); } }}
                      className="h-6 border-0 shadow-none px-1 focus-visible:ring-0 bg-transparent text-sm flex-1"
                    />
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-20 text-muted-foreground">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeItem(idx)}
                        className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add item */}
              <div className="flex gap-2 mt-1">
                <Input
                  ref={newItemRef}
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  placeholder="Type a new checklist item and press Enter…"
                  className="h-8 text-sm"
                />
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1"
                  onClick={addItem} disabled={!newItem.trim()}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allCards = [] } = useListCards({});
  const { data: teams = [] }   = useListTeams();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/templates`);
      return r.json();
    },
  });

  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  // Apply-to-card state
  const [applyDialog, setApplyDialog]     = useState<Template | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [selectedItems, setSelectedItems]   = useState<Set<number>>(new Set());
  const [applying, setApplying]           = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["templates"] });

  const openCreate = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit   = (tpl: Template) => { setEditTarget(tpl); setEditorOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`${BASE}/api/templates/${deleteTarget.id}`, { method: "DELETE" });
    refresh();
    toast({ title: `Deleted "${deleteTarget.name}"` });
    setDeleteTarget(null);
  };

  const openApplyDialog = (tpl: Template) => {
    setApplyDialog(tpl);
    setSelectedCardId("");
    setSelectedItems(new Set(tpl.items.map((_, i) => i)));
  };

  const toggleItem = (i: number) =>
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const handleApply = async () => {
    if (!applyDialog || !selectedCardId) return;
    setApplying(true);
    const cardId = parseInt(selectedCardId);
    const items  = applyDialog.items.filter((_, i) => selectedItems.has(i));
    try {
      await Promise.all(
        items.map((item, idx) =>
          fetch(`${BASE}/api/cards/${cardId}/checklist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: item.text, done: false, position: idx }),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: `Applied ${items.length} checklist items to card` });
      setApplyDialog(null);
    } catch {
      toast({ title: "Failed to apply template", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const teamMap   = Object.fromEntries((teams as Team[]).map(t => [t.id, t]));
  const cardsByTeam = (teams as Team[]).map(t => ({
    team: t,
    cards: (allCards as Card[]).filter(c => c.teamId === t.id && c.status !== "done"),
  })).filter(g => g.cards.length > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Card Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-built checklists with institutional knowledge baked in.
            Apply any template to an existing card — nothing is applied automatically.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="border rounded-xl bg-card h-44 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No templates yet.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map(tpl => {
            const isExpanded = expandedId === tpl.id;
            return (
              <div key={tpl.id}
                className="border rounded-xl bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {/* Card header */}
                <div className="p-4 pb-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: tpl.color }}>
                    {renderIcon(tpl.icon, "w-5 h-5")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight">{tpl.name}</h3>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                  {/* Edit / delete */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => openEdit(tpl)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit template">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tpl)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                      title="Delete template">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Checklist toggle */}
                <div
                  className="border-t cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : tpl.id)}>
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{tpl.items.length} checklist item{tpl.items.length !== 1 ? "s" : ""}</span>
                    </div>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>

                  {isExpanded && (
                    <ScrollArea className="max-h-56">
                      <div className="px-4 py-2 space-y-1.5">
                        {tpl.items.map((item, i) => (
                          <div key={item.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="w-4 shrink-0 text-right font-mono text-[10px] mt-0.5 text-muted-foreground/50">
                              {i + 1}
                            </span>
                            <div className="w-3.5 h-3.5 rounded border border-border mt-0.5 shrink-0" />
                            <span>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t bg-muted/10 mt-auto flex gap-2">
                  <Button size="sm" className="flex-1 gap-2 h-8"
                    onClick={() => openApplyDialog(tpl)}>
                    <Plus className="w-3.5 h-3.5" /> Apply to Card
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 gap-1.5"
                    onClick={() => openEdit(tpl)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template editor */}
      <TemplateEditor
        open={editorOpen}
        initial={editTarget}
        onClose={() => setEditorOpen(false)}
        onSaved={refresh}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This template and all its checklist items will be permanently removed.
              Cards that had these items applied are unaffected.
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

      {/* Apply-to-card dialog */}
      <Dialog open={!!applyDialog} onOpenChange={open => { if (!open) setApplyDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Apply "{applyDialog?.name}" to Card
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Card <span className="text-destructive">*</span></Label>
              <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a card…" /></SelectTrigger>
                <SelectContent>
                  {cardsByTeam.map(({ team, cards }) => (
                    <React.Fragment key={team.id}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </div>
                      {cards.map(c => (
                        <SelectItem key={c.id} value={String(c.id)} className="pl-5">
                          {c.title}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Items to Apply</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => setSelectedItems(new Set(applyDialog!.items.map((_, i) => i)))}>
                    All
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => setSelectedItems(new Set())}>
                    None
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-56 border rounded-lg p-2">
                <div className="space-y-1.5">
                  {applyDialog?.items.map((item, i) => (
                    <div key={item.id}
                      className="flex items-start gap-2.5 py-1 px-1 rounded hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggleItem(i)}>
                      <Checkbox checked={selectedItems.has(i)} className="mt-0.5 shrink-0" />
                      <span className="text-xs leading-relaxed">{item.text}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">
                {selectedItems.size} of {applyDialog?.items.length} items selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(null)}>Cancel</Button>
            <Button onClick={handleApply}
              disabled={applying || !selectedCardId || selectedItems.size === 0}>
              {applying ? "Applying…" : `Apply ${selectedItems.size} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
