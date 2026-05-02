import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListCards, useListTeams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  BookOpen, GitBranch, Beaker, FileText, CheckSquare,
  Plus, ClipboardList, ChevronDown, ChevronRight, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Card templates (institutional knowledge baked in) ─────────────────────────
interface ChecklistTemplate {
  text: string;
  done: boolean;
}

interface CardTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  defaultStatus: string;
  defaultPriority: string;
  checklist: ChecklistTemplate[];
  tags: string[];
}

const TEMPLATES: CardTemplate[] = [
  {
    id: "new_research_study",
    title: "New Research Study",
    description: "Full lifecycle for a new VA clinical research project from conception to dissemination.",
    icon: <Beaker className="w-5 h-5" />,
    color: "#8b5cf6",
    defaultStatus: "not_started",
    defaultPriority: "high",
    tags: ["research", "IRB", "VA"],
    checklist: [
      { text: "Define research question and specific aims", done: false },
      { text: "Literature review and gap analysis", done: false },
      { text: "Draft study protocol", done: false },
      { text: "Submit IRB application", done: false },
      { text: "Obtain IRB approval", done: false },
      { text: "Data access request (CDW / VINCI / TriNetX)", done: false },
      { text: "Data access approved", done: false },
      { text: "Data extraction and validation", done: false },
      { text: "Exploratory data analysis (EDA)", done: false },
      { text: "Statistical analysis plan (SAP)", done: false },
      { text: "Run primary analyses", done: false },
      { text: "Draft manuscript", done: false },
      { text: "Internal review and revisions", done: false },
      { text: "Submit to target journal", done: false },
      { text: "Address peer review comments", done: false },
      { text: "Manuscript accepted", done: false },
      { text: "Dissemination (conference / brief / operations brief)", done: false },
    ],
  },
  {
    id: "data_pipeline",
    title: "Data Pipeline Build",
    description: "Standard steps for building a new data extraction, transformation, and loading pipeline.",
    icon: <GitBranch className="w-5 h-5" />,
    color: "#0ea5e9",
    defaultStatus: "not_started",
    defaultPriority: "medium",
    tags: ["data", "engineering", "pipeline"],
    checklist: [
      { text: "Define data requirements and sources", done: false },
      { text: "Request data access (VA CDW / VINCI)", done: false },
      { text: "Schema discovery and documentation", done: false },
      { text: "Draft extraction query (SQL / SAS)", done: false },
      { text: "Data quality assessment (nulls, ranges, duplicates)", done: false },
      { text: "Cohort definition and inclusion/exclusion criteria", done: false },
      { text: "Variable derivation and calculated fields", done: false },
      { text: "De-identification / PHI removal check", done: false },
      { text: "Pipeline unit tests", done: false },
      { text: "Generate data dictionary", done: false },
      { text: "Peer code review", done: false },
      { text: "Final dataset locked and versioned", done: false },
      { text: "Analytic file delivered to team", done: false },
    ],
  },
  {
    id: "app_feature_sprint",
    title: "App Feature Sprint",
    description: "Agile sprint checklist for building and deploying a new application feature.",
    icon: <Zap className="w-5 h-5" />,
    color: "#10b981",
    defaultStatus: "not_started",
    defaultPriority: "medium",
    tags: ["dev", "sprint", "feature"],
    checklist: [
      { text: "Requirements gathering and stakeholder sign-off", done: false },
      { text: "Technical design / architecture review", done: false },
      { text: "Create feature branch", done: false },
      { text: "Backend API implementation", done: false },
      { text: "Frontend UI implementation", done: false },
      { text: "Unit and integration tests", done: false },
      { text: "Internal UAT (user acceptance testing)", done: false },
      { text: "Accessibility and security review", done: false },
      { text: "Documentation updated", done: false },
      { text: "Code review approved", done: false },
      { text: "Merge to main / deploy to staging", done: false },
      { text: "Stakeholder demo and sign-off", done: false },
      { text: "Deploy to production", done: false },
      { text: "Post-deploy monitoring (24–48h)", done: false },
    ],
  },
  {
    id: "manuscript_preparation",
    title: "Manuscript Preparation",
    description: "Focused checklist for taking analysis results through to a published paper.",
    icon: <FileText className="w-5 h-5" />,
    color: "#f59e0b",
    defaultStatus: "not_started",
    defaultPriority: "high",
    tags: ["writing", "manuscript", "publication"],
    checklist: [
      { text: "Finalize analysis results (tables, figures)", done: false },
      { text: "Select target journal and review submission guidelines", done: false },
      { text: "Draft Introduction", done: false },
      { text: "Draft Methods", done: false },
      { text: "Draft Results", done: false },
      { text: "Draft Discussion and Conclusion", done: false },
      { text: "Compile references (EndNote / Zotero)", done: false },
      { text: "Author list finalized and contributions documented", done: false },
      { text: "Co-author review round 1", done: false },
      { text: "Address co-author comments", done: false },
      { text: "VA Public Affairs / Operations review (if required)", done: false },
      { text: "Final proofreading", done: false },
      { text: "Format per journal guidelines", done: false },
      { text: "Submit via journal portal", done: false },
      { text: "Acknowledge receipt / tracking number", done: false },
    ],
  },
];

interface Card {
  id: number;
  title: string;
  teamId: number;
  status: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allCards = [] } = useListCards({});
  const { data: teams = [] } = useListTeams();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyDialog, setApplyDialog] = useState<CardTemplate | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  const openApplyDialog = (tpl: CardTemplate) => {
    setApplyDialog(tpl);
    setSelectedCardId("");
    setSelectedItems(new Set(tpl.checklist.map((_, i) => i)));
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

    const items = applyDialog.checklist.filter((_, i) => selectedItems.has(i));
    try {
      await Promise.all(
        items.map((item, idx) =>
          fetch(`${BASE}/api/cards/${cardId}/checklist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: item.text, done: item.done, position: idx }),
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

  const teamMap = Object.fromEntries((teams as Team[]).map(t => [t.id, t]));

  const cardsByTeam = (teams as Team[]).map(t => ({
    team: t,
    cards: (allCards as Card[]).filter(c => c.teamId === t.id && c.status !== "done"),
  })).filter(g => g.cards.length > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Card Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pre-built checklists with institutional knowledge baked in. Apply any template to an existing card — nothing is applied automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TEMPLATES.map(tpl => {
          const isExpanded = expandedId === tpl.id;
          return (
            <div key={tpl.id}
              className="border rounded-xl bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Card header */}
              <div className="p-4 pb-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: tpl.color }}>
                  {tpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">{tpl.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tpl.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Checklist preview */}
              <div
                className="border-t cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
              >
                <div className="flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{tpl.checklist.length} checklist items</span>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  }
                </div>

                {isExpanded && (
                  <ScrollArea className="max-h-56">
                    <div className="px-4 py-2 space-y-1.5">
                      {tpl.checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <div className="w-3.5 h-3.5 rounded border border-border mt-0.5 shrink-0" />
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Apply button */}
              <div className="px-4 py-3 border-t bg-muted/10">
                <Button size="sm" className="w-full gap-2 h-8"
                  onClick={() => openApplyDialog(tpl)}>
                  <Plus className="w-3.5 h-3.5" /> Apply to Card
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply dialog */}
      <Dialog open={!!applyDialog} onOpenChange={open => { if (!open) setApplyDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Apply "{applyDialog?.title}" to Card
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
                    onClick={() => setSelectedItems(new Set(applyDialog!.checklist.map((_, i) => i)))}>
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
                  {applyDialog?.checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1 px-1 rounded hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggleItem(i)}>
                      <Checkbox checked={selectedItems.has(i)} className="mt-0.5 shrink-0" />
                      <span className="text-xs leading-relaxed">{item.text}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">
                {selectedItems.size} of {applyDialog?.checklist.length} items selected
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
