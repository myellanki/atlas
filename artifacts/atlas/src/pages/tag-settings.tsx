import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAllTags, CustomTag, TAG_QUERY_KEY } from "@/hooks/use-tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Database, Filter, Plus, Pencil, Trash2, Check, X, GripVertical, Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Category = "data_source" | "cohort";

interface TagRowProps {
  tag: CustomTag;
  onSaved: () => void;
  onDeleted: () => void;
}

function TagRow({ tag, onSaved, onDeleted }: TagRowProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tag.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(tag.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue(tag.name);
  };

  const saveEdit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === tag.name) { cancelEdit(); return; }
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) throw new Error("Save failed");
      setEditing(false);
      onSaved();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${tag.name}"? Cards currently tagged with it will lose this tag on next edit.`)) return;
    await fetch(`${BASE}/api/tags/${tag.id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border group transition-colors",
      editing ? "bg-background border-primary/40 shadow-sm" : "bg-card hover:bg-muted/30 border-border/50"
    )}>
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />

      {editing ? (
        <>
          <Input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-7 text-sm flex-1 border-0 px-1 shadow-none focus-visible:ring-0 bg-transparent"
            disabled={saving}
          />
          <button onClick={saveEdit} disabled={saving}
            className="p-1 rounded hover:bg-primary/10 text-primary shrink-0">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancelEdit} disabled={saving}
            className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{tag.name}</span>
          <button onClick={startEdit}
            className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Rename">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={handleDelete}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}

interface AddRowProps {
  category: Category;
  onAdded: () => void;
}

function AddRow({ category, onAdded }: AddRowProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setValue("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleAdd = async () => {
    const trimmed = value.trim();
    if (!trimmed) { setOpen(false); return; }
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name: trimmed }),
      });
      if (!r.ok) throw new Error();
      setValue("");
      setOpen(false);
      onAdded();
    } catch {
      toast({ title: "Failed to add tag", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground w-full justify-start mt-1"
        onClick={openAdd}>
        <Plus className="w-3.5 h-3.5" /> Add {category === "data_source" ? "data source" : "cohort"}…
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background border-primary/40 shadow-sm mt-1">
      <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
      <Input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") { setOpen(false); }
        }}
        placeholder={category === "data_source" ? "e.g. Medicare Claims" : "e.g. Agent Orange Exposed"}
        className="h-7 text-sm flex-1 border-0 px-1 shadow-none focus-visible:ring-0 bg-transparent"
        disabled={saving}
      />
      <button onClick={handleAdd} disabled={saving || !value.trim()}
        className="p-1 rounded hover:bg-primary/10 text-primary shrink-0 disabled:opacity-40">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setOpen(false)} disabled={saving}
        className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface TagSectionProps {
  title: string;
  icon: React.ReactNode;
  category: Category;
  description: string;
  tags: CustomTag[];
  onChanged: () => void;
}

function TagSection({ title, icon, category, description, tags, onChanged }: TagSectionProps) {
  const filtered = tags.filter(t => t.category === category);

  return (
    <div className="flex-1 min-w-[260px] max-w-lg">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {filtered.length}
        </span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No {category === "data_source" ? "data sources" : "cohorts"} yet.
            </div>
          ) : (
            filtered.map(tag => (
              <TagRow key={tag.id} tag={tag} onSaved={onChanged} onDeleted={onChanged} />
            ))
          )}
          <AddRow category={category} onAdded={onChanged} />
        </div>
      </div>
    </div>
  );
}

export default function TagSettingsPage() {
  const queryClient = useQueryClient();
  const { data: allTags = [], isLoading } = useAllTags();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEY() });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" />
          Tag Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage the data source and cohort/era tags that can be applied to project cards.
          Tags appear as filters on the Projects page and as dropdowns in the card detail drawer.
        </p>
      </div>

      {isLoading ? (
        <div className="flex gap-6 flex-wrap">
          {[0, 1].map(i => (
            <div key={i} className="flex-1 min-w-[260px] max-w-lg space-y-2">
              <Skeleton className="h-8 w-48" />
              {[1,2,3,4,5].map(j => <Skeleton key={j} className="h-10 rounded-lg" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-6 flex-wrap items-start">
          <TagSection
            title="Data Sources"
            icon={<Database className="w-4 h-4" />}
            category="data_source"
            description="VA data systems used in the project"
            tags={allTags}
            onChanged={refresh}
          />
          <TagSection
            title="Cohorts &amp; Eras"
            icon={<Filter className="w-4 h-4" />}
            category="cohort"
            description="Veteran populations or cancer types"
            tags={allTags}
            onChanged={refresh}
          />
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How tags work</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Open any card's detail drawer and set a <strong>Data Source</strong> and <strong>Cohort/Era</strong> from the dropdowns.</li>
          <li>The <strong>Projects</strong> page has filter dropdowns for both — use them to quickly see which studies use a particular data system or focus on a specific cohort.</li>
          <li>Renaming a tag here automatically updates the dropdown everywhere (the stored value on cards is the tag name, so rename carefully).</li>
          <li>Deleting a tag removes it from the dropdown but doesn't remove the saved value from existing cards until those cards are re-edited.</li>
        </ul>
      </div>
    </div>
  );
}
