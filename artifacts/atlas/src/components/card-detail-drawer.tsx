import React, { useState, useEffect, useRef } from "react";
import { 
  useGetCard, 
  useUpdateCard, 
  useCreateNote, 
  useListNotes,
  useListLabels,
  useAddCardLabel,
  useRemoveCardLabel,
  useListChecklistItems,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useListMembers,
  useListCards,
  useListLinks,
  useCreateLink,
  useDeleteLink,
  getGetCardQueryKey,
  getListNotesQueryKey,
  getListChecklistItemsQueryKey,
  getListCardsQueryKey,
  getListLinksQueryKey,
  useCreateCard
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  CalendarIcon, MessageSquare, Plus, CheckSquare, Tags, Trash2, X,
  Send, AlertCircle, Users, Link2, ExternalLink, ArrowUpRight, Globe, Layers,
  BookOpen, Database, Filter as FilterIcon, Paperclip, Download, FileText,
  File, ImageIcon, FileSpreadsheet, Network, Archive, ArchiveRestore,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const DELIVERABLE_TYPES = [
  { value: "paper",      label: "Journal Paper" },
  { value: "report",     label: "Report" },
  { value: "conference", label: "Conference" },
  { value: "product",    label: "Operational Product" },
];
const DELIVERABLE_STATUSES = [
  { value: "drafting",  label: "Drafting" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted",  label: "Accepted" },
  { value: "published", label: "Published" },
];
interface Deliverable {
  id: number; cardId: number; title: string; type: string;
  targetDate: string | null; status: string; journal: string | null;
  firstAuthor: string | null; doi: string | null; url: string | null;
  notes: string | null; publishedYear: number | null;
}
import { useToast } from "@/hooks/use-toast";
import { useTagsByCategory } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-200 text-slate-700",
  in_progress: "bg-primary/20 text-primary",
  blocked: "bg-destructive/20 text-destructive",
  in_review: "bg-purple-500/20 text-purple-600",
  done: "bg-green-500/20 text-green-700",
};

export default function CardDetailDrawer() {
  const { selectedCardId, setSelectedCardId, role } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isNew = selectedCardId === -1;
  const isOpen = selectedCardId !== null;
  const { data: dataSources = [] } = useTagsByCategory("data_source");
  const { data: cohorts = [] } = useTagsByCategory("cohort");

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: card } = useGetCard(selectedCardId > 0 ? selectedCardId : 0, { 
    query: { enabled: selectedCardId > 0 } 
  });
  const { data: notes } = useListNotes(selectedCardId > 0 ? selectedCardId : 0, {
    query: { enabled: selectedCardId > 0 }
  });
  const { data: checklist } = useListChecklistItems(selectedCardId > 0 ? selectedCardId : 0, {
    query: { enabled: selectedCardId > 0 }
  });
  const { data: links } = useListLinks(selectedCardId > 0 ? selectedCardId : 0, {
    query: { enabled: selectedCardId > 0 }
  });
  const { data: allLabels } = useListLabels();
  const { data: allMembers } = useListMembers();
  const { data: allCards } = useListCards({}, {
    query: { enabled: isOpen }
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateCard = useUpdateCard();
  const createCard = useCreateCard();
  const addLabel = useAddCardLabel();
  const removeLabel = useRemoveCardLabel();
  const createNote = useCreateNote();
  const createChecklist = useCreateChecklistItem();
  const updateChecklist = useUpdateChecklistItem();
  const createLink = useCreateLink();
  const deleteLink = useDeleteLink();

  // ── Local state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkMode, setLinkMode] = useState<"url" | "card">("url");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCardId, setLinkCardId] = useState<number | null>(null);
  const [cardSearch, setCardSearch] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Deliverables state
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [deliverableForm, setDeliverableForm] = useState({
    title: "", type: "paper", status: "drafting", journal: "", firstAuthor: "",
    targetDate: "", doi: "", url: "", notes: "", publishedYear: "",
  });
  const [savingDeliverable, setSavingDeliverable] = useState(false);

  // Data source / cohort tag state
  const [tagDataSource, setTagDataSource] = useState<string>("");
  const [tagCohort, setTagCohort] = useState<string>("");
  const [savingTags, setSavingTags] = useState(false);

  // Attachments state
  interface Attachment { id: number; cardId: number; filename: string; originalName: string; mimeType: string | null; fileSize: number | null; uploadedAt: string; }
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async (cardId: number) => {
    setLoadingAttachments(true);
    try {
      const r = await fetch(`${BASE}/api/cards/${cardId}/attachments`);
      const data = await r.json();
      setAttachments(data);
    } catch { /* ignore */ } finally { setLoadingAttachments(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCardId || selectedCardId < 1) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BASE}/api/cards/${selectedCardId}/attachments`, { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      await fetchAttachments(selectedCardId);
      toast({ title: `Uploaded "${file.name}"` });
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (!selectedCardId) return;
    await fetch(`${BASE}/api/cards/${selectedCardId}/attachments/${att.id}`, { method: "DELETE" });
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    toast({ title: `Removed "${att.originalName}"` });
  };

  function attachmentIcon(mime: string | null) {
    if (!mime) return <File className="w-4 h-4" />;
    if (mime.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-purple-500" />;
    if (mime === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
    if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    if (mime.includes("word")) return <FileText className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  }

  function formatBytes(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // Dependencies state
  interface CardDep {
    id: number; cardId: number; dependsOnCardId: number;
    dependsOnCard: { id: number; title: string; status: string; teamId: number | null } | null;
  }
  const [deps, setDeps] = useState<CardDep[]>([]);
  const [showDepDialog, setShowDepDialog] = useState(false);
  const [depSearch, setDepSearch] = useState("");

  const fetchDeps = async (cardId: number) => {
    try {
      const r = await fetch(`${BASE}/api/cards/${cardId}/dependencies`);
      setDeps(await r.json());
    } catch { /* ignore */ }
  };

  const addDep = async (depCardId: number) => {
    if (!selectedCardId || selectedCardId < 1) return;
    const r = await fetch(`${BASE}/api/cards/${selectedCardId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnCardId: depCardId }),
    });
    if (r.ok) {
      await fetchDeps(selectedCardId);
      setShowDepDialog(false); setDepSearch("");
      toast({ title: "Dependency added" });
    } else {
      const d = await r.json();
      toast({ title: d.error ?? "Failed to add dependency", variant: "destructive" });
    }
  };

  const removeDep = async (depId: number) => {
    if (!selectedCardId) return;
    await fetch(`${BASE}/api/cards/${selectedCardId}/dependencies/${depId}`, { method: "DELETE" });
    setDeps(prev => prev.filter(d => d.id !== depId));
    toast({ title: "Dependency removed" });
  };

  const initializedForId = useRef<number | null>(null);

  // ── Sync card data to local state ──────────────────────────────────────────
  useEffect(() => {
    if (selectedCardId === -1) {
      setTitle("New Project Card");
      setDescription("");
      initializedForId.current = -1;
    } else if (card && initializedForId.current !== card.id) {
      setTitle(card.title);
      setDescription(card.description || "");
      initializedForId.current = card.id;
    }
  }, [card, selectedCardId]);

  // Reset link dialog when closed
  useEffect(() => {
    if (!showLinkDialog) {
      setLinkTitle("");
      setLinkUrl("");
      setLinkCardId(null);
      setCardSearch("");
      setLinkMode("url");
    }
  }, [showLinkDialog]);

  // Load deliverables + attachments + sync tags when card changes
  useEffect(() => {
    if (!card || selectedCardId <= 0) {
      setDeliverables([]);
      setAttachments([]);
      return;
    }
    setLoadingDeliverables(true);
    fetch(`${BASE}/api/cards/${card.id}/deliverables`)
      .then(r => r.json())
      .then(data => setDeliverables(Array.isArray(data) ? data : []))
      .catch(() => setDeliverables([]))
      .finally(() => setLoadingDeliverables(false));
    fetchAttachments(card.id);
    fetchDeps(card.id);
    // sync tag state from card (uses 'any' because the generated type doesn't include these fields yet)
    setTagDataSource((card as any).dataSource ?? "");
    setTagCohort((card as any).cohort ?? "");
  }, [card?.id]);

  const handleSaveTags = async () => {
    if (!card) return;
    setSavingTags(true);
    try {
      await fetch(`${BASE}/api/cards/${card.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataSource: tagDataSource || null,
          cohort: tagCohort || null,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
    } finally {
      setSavingTags(false);
    }
  };

  const openDeliverableCreate = () => {
    setEditingDeliverable(null);
    setDeliverableForm({ title: "", type: "paper", status: "drafting", journal: "", firstAuthor: "", targetDate: "", doi: "", url: "", notes: "", publishedYear: "" });
    setShowDeliverableForm(true);
  };

  const openDeliverableEdit = (d: Deliverable) => {
    setEditingDeliverable(d);
    setDeliverableForm({
      title: d.title, type: d.type, status: d.status,
      journal: d.journal ?? "", firstAuthor: d.firstAuthor ?? "",
      targetDate: d.targetDate ?? "", doi: d.doi ?? "",
      url: d.url ?? "", notes: d.notes ?? "",
      publishedYear: d.publishedYear ? String(d.publishedYear) : "",
    });
    setShowDeliverableForm(true);
  };

  const handleSaveDeliverable = async () => {
    if (!card || !deliverableForm.title) return;
    setSavingDeliverable(true);
    const payload = {
      title: deliverableForm.title,
      type: deliverableForm.type,
      status: deliverableForm.status,
      journal: deliverableForm.journal || null,
      firstAuthor: deliverableForm.firstAuthor || null,
      targetDate: deliverableForm.targetDate || null,
      doi: deliverableForm.doi || null,
      url: deliverableForm.url || null,
      notes: deliverableForm.notes || null,
      publishedYear: deliverableForm.publishedYear ? parseInt(deliverableForm.publishedYear) : null,
    };
    try {
      if (editingDeliverable) {
        const r = await fetch(`${BASE}/api/deliverables/${editingDeliverable.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const updated = await r.json();
        setDeliverables(prev => prev.map(d => d.id === updated.id ? updated : d));
      } else {
        const r = await fetch(`${BASE}/api/cards/${card.id}/deliverables`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const created = await r.json();
        setDeliverables(prev => [...prev, created]);
      }
      setShowDeliverableForm(false);
    } finally {
      setSavingDeliverable(false);
    }
  };

  const handleDeleteDeliverable = async (id: number) => {
    if (!window.confirm("Remove this deliverable/publication?")) return;
    await fetch(`${BASE}/api/deliverables/${id}`, { method: "DELETE" });
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleClose = () => {
    setSelectedCardId(null);
    initializedForId.current = null;
  };

  const handleTitleBlur = () => {
    if (isNew) return;
    if (title !== card?.title && role === 'admin') {
      updateCard.mutate({ cardId: card.id, data: { title } }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetCardQueryKey(card.id), (old: any) => ({ ...old, title }));
          queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
        }
      });
    }
  };

  const handleDescriptionBlur = () => {
    if (isNew) return;
    if (description !== card?.description && role === 'admin') {
      updateCard.mutate({ cardId: card.id, data: { description } }, {
        onSuccess: () => queryClient.setQueryData(getGetCardQueryKey(card.id), (old: any) => ({ ...old, description }))
      });
    }
  };

  const handleStatusChange = (status: any) => {
    if (isNew || role !== 'admin') return;
    updateCard.mutate({ cardId: card.id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
      }
    });
  };

  const handlePriorityChange = (priority: any) => {
    if (isNew || role !== 'admin') return;
    updateCard.mutate({ cardId: card.id, data: { priority } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
      }
    });
  };

  const handleAssigneeChange = (assigneeIdStr: string) => {
    if (isNew || role !== 'admin') return;
    const assigneeId = assigneeIdStr === "none" ? null : parseInt(assigneeIdStr);
    updateCard.mutate({ cardId: card.id, data: { assigneeId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
      }
    });
  };

  const handleDateChange = (field: 'startDate' | 'dueDate', date: Date | undefined) => {
    if (isNew || role !== 'admin') return;
    const dateStr = date ? date.toISOString() : null;
    updateCard.mutate({ cardId: card.id, data: { [field]: dateStr } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) })
    });
  };

  const toggleLabel = (labelId: number, hasLabel: boolean) => {
    if (isNew || role !== 'admin') return;
    if (hasLabel) {
      removeLabel.mutate({ cardId: card.id, labelId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) })
      });
    } else {
      addLabel.mutate({ cardId: card.id, data: { labelId } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) })
      });
    }
  };

  const submitNote = () => {
    if (!newNote.trim() || isNew) return;
    createNote.mutate({
      cardId: card.id,
      data: { content: newNote, authorName: "Current User" }
    }, {
      onSuccess: () => {
        setNewNote("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
      }
    });
  };

  const submitChecklist = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newChecklistItem.trim() && !isNew) {
      createChecklist.mutate({
        cardId: card.id,
        data: { text: newChecklistItem }
      }, {
        onSuccess: () => {
          setNewChecklistItem("");
          queryClient.invalidateQueries({ queryKey: getListChecklistItemsQueryKey(card.id) });
        }
      });
    }
  };

  const toggleChecklist = (id: number, done: boolean) => {
    if (isNew) return;
    updateChecklist.mutate({ itemId: id, data: { done: !done } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChecklistItemsQueryKey(card.id) })
    });
  };

  const handleCreate = () => {
    if (!title) return toast({ title: "Title required", variant: "destructive" });
    createCard.mutate({
      data: { teamId: 1, title, description, status: "not_started", priority: "medium" }
    }, {
      onSuccess: (newCard) => {
        toast({ title: "Card created" });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
        setSelectedCardId(newCard.id);
      }
    });
  };

  // ── Link handlers ──────────────────────────────────────────────────────────
  const handleSubmitLink = async () => {
    if (!card) return;

    if (linkMode === "url") {
      if (!linkTitle.trim() || !linkUrl.trim()) {
        toast({ title: "Title and URL are required", variant: "destructive" });
        return;
      }
      // Basic URL validation
      try { new URL(linkUrl); } catch {
        toast({ title: "Please enter a valid URL (include https://)", variant: "destructive" });
        return;
      }
    } else {
      if (!linkCardId) {
        toast({ title: "Please select a card to link", variant: "destructive" });
        return;
      }
    }

    setLinkSaving(true);
    try {
      if (linkMode === "url") {
        await createLink.mutateAsync({
          cardId: card.id,
          data: { title: linkTitle.trim(), url: linkUrl.trim() }
        });
      } else {
        const linkedCard = allCards?.find(c => c.id === linkCardId);
        await createLink.mutateAsync({
          cardId: card.id,
          data: {
            title: linkTitle.trim() || linkedCard?.title || `Card #${linkCardId}`,
            url: "",
            linkedCardId: linkCardId
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: getListLinksQueryKey(card.id) });
      queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
      setShowLinkDialog(false);
      toast({ title: "Link added" });
    } catch {
      toast({ title: "Failed to add link", variant: "destructive" });
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteLink = (linkId: number) => {
    if (!card) return;
    deleteLink.mutate({ linkId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLinksQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
      }
    });
  };

  // ── Archive / unarchive ────────────────────────────────────────────────────
  const handleArchiveCard = async (archive: boolean) => {
    if (!card) return;
    await fetch(`${BASE}/api/cards/${card.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    });
    queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(card.id) });
    queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
    toast({
      title: archive ? "Card archived" : "Card restored",
      description: archive ? "Find it in the archived section of the board column." : undefined,
    });
  };

  // Filtered cards for the card-reference picker (exclude current card)
  const filteredCards = allCards?.filter(c =>
    c.id !== selectedCardId &&
    (cardSearch === "" ||
      c.title.toLowerCase().includes(cardSearch.toLowerCase()) ||
      `#${c.id}`.includes(cardSearch))
  ) ?? [];

  const isAdmin = role === 'admin';

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col h-full bg-background border-l shadow-2xl">
          <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-6 pb-4 border-b shrink-0 bg-card">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="text-xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 shadow-none -ml-2"
                placeholder="Card Title"
                readOnly={!isAdmin && !isNew}
              />
              {!isNew && card && (
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  {(card as any).archived && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 gap-1 text-xs">
                      <Archive className="w-3 h-3" /> Archived
                    </Badge>
                  )}
                  {card.labels.map(l => (
                    <Badge key={l.id} style={{ backgroundColor: l.color }} className="text-white border-none shadow-sm hover:brightness-110">
                      {l.name}
                    </Badge>
                  ))}
                  {isAdmin && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-xs rounded-full bg-muted/50 border-dashed">
                          <Plus className="w-3 h-3 mr-1" /> Add Label
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-1">
                          <h4 className="text-xs font-medium text-muted-foreground px-2 py-1">Select Labels</h4>
                          {allLabels?.map(label => {
                            const hasLabel = card.labels.some(l => l.id === label.id);
                            return (
                              <div
                                key={label.id}
                                className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer text-sm"
                                onClick={() => toggleLabel(label.id, hasLabel)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }} />
                                  <span>{label.name}</span>
                                </div>
                                {hasLabel && <CheckSquare className="w-4 h-4 text-primary" />}
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  <div className="ml-auto">
                    {(card as any).archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 border-green-400 text-green-700 hover:bg-green-50"
                        onClick={() => handleArchiveCard(false)}
                      >
                        <ArchiveRestore className="w-3 h-3" /> Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => handleArchiveCard(true)}
                      >
                        <Archive className="w-3 h-3" /> Archive
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 p-6">
              {isNew || card ? (
                <div className="space-y-8 pb-10">
                  {/* Properties Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><CheckSquare className="w-3 h-3" /> Status</Label>
                      <Select value={card?.status || "not_started"} onValueChange={handleStatusChange} disabled={!isAdmin || isNew}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Priority</Label>
                      <Select value={card?.priority || "medium"} onValueChange={handlePriorityChange} disabled={!isAdmin || isNew}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Assignee</Label>
                      <Select value={card?.assigneeId?.toString() || "none"} onValueChange={handleAssigneeChange} disabled={!isAdmin || isNew}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {allMembers?.map(m => (
                            <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Due Date</Label>
                      {isAdmin && !isNew ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full h-8 justify-start text-left font-normal px-3", !card?.dueDate && "text-muted-foreground")}>
                              {card?.dueDate ? format(new Date(card.dueDate), "MMM d, yyyy") : <span>Set date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={card?.dueDate ? new Date(card.dueDate) : undefined} onSelect={d => handleDateChange('dueDate', d)} />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="h-8 flex items-center px-3 border rounded-md bg-muted/50 text-sm">
                          {card?.dueDate ? format(new Date(card.dueDate), "MMM d, yyyy") : "None"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-sm">Description</Label>
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      onBlur={handleDescriptionBlur}
                      placeholder="Add more details to this card..."
                      className="min-h-[100px] resize-y bg-muted/20 border-border/50 focus:bg-background"
                      readOnly={!isAdmin && !isNew}
                    />
                  </div>

                  {!isNew && (
                    <>
                      <Separator />

                      {/* Checklist */}
                      <div className="space-y-3">
                        <Label className="font-semibold text-sm flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-primary" /> Checklist
                          {checklist && checklist.length > 0 && (
                            <span className="text-xs font-normal text-muted-foreground ml-auto">
                              {checklist.filter(i => i.done).length}/{checklist.length} done
                            </span>
                          )}
                        </Label>
                        <div className="space-y-2">
                          {checklist?.map(item => (
                            <div key={item.id} className="flex items-start gap-3 group">
                              <button
                                className={cn(
                                  "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                  item.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50 hover:border-primary"
                                )}
                                onClick={() => toggleChecklist(item.id, item.done)}
                                aria-label={item.done ? "Mark incomplete" : "Mark complete"}
                              >
                                {item.done && <CheckSquare className="w-3 h-3" />}
                              </button>
                              <span className={cn("text-sm leading-tight", item.done && "text-muted-foreground line-through opacity-70")}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                          {isAdmin && (
                            <Input
                              value={newChecklistItem}
                              onChange={e => setNewChecklistItem(e.target.value)}
                              onKeyDown={submitChecklist}
                              placeholder="Add item (Press Enter)"
                              className="h-8 text-sm bg-transparent border-dashed mt-2"
                            />
                          )}
                        </div>
                      </div>

                      {/* ── Dependencies ─────────────────────────────────────── */}
                      {(deps.length > 0 || (isAdmin && !isNew)) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                              <Network className="w-3.5 h-3.5" /> Blocked By
                              {deps.length > 0 && <span className="text-[10px]">({deps.length})</span>}
                            </Label>
                            {isAdmin && !isNew && (
                              <button
                                onClick={() => setShowDepDialog(true)}
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            )}
                          </div>
                          {deps.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {deps.map(d => (
                                <div key={d.id} className="flex items-center gap-1 text-xs bg-muted/60 rounded-md px-2 py-1 border group hover:bg-muted transition-colors">
                                  <button
                                    className="hover:text-primary transition-colors font-medium truncate max-w-[150px]"
                                    onClick={() => setSelectedCardId(d.dependsOnCardId)}
                                    title={d.dependsOnCard?.title}
                                  >
                                    {d.dependsOnCard?.title ?? `Card #${d.dependsOnCardId}`}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => removeDep(d.id)}
                                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ml-0.5 shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {deps.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No dependencies. Click Add to link a blocking card.</p>
                          )}
                        </div>
                      )}

                      <Separator />

                      {/* ── Links & References ─────────────────────────────────── */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-primary" /> Links & References
                            {links && links.length > 0 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">{links.length}</Badge>
                            )}
                          </Label>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => setShowLinkDialog(true)}
                            >
                              <Plus className="w-3 h-3" /> Add Link
                            </Button>
                          )}
                        </div>

                        {links && links.length > 0 ? (
                          <div className="space-y-2">
                            {links.map(link => {
                              const isCardLink = !!link.linkedCardId;
                              return (
                                <div
                                  key={link.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group"
                                >
                                  <div className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                                    isCardLink ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  )}>
                                    {isCardLink
                                      ? <Layers className="w-3.5 h-3.5" />
                                      : <Globe className="w-3.5 h-3.5" />
                                    }
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    {isCardLink ? (
                                      <button
                                        className="text-sm font-medium text-left w-full truncate hover:text-primary transition-colors flex items-center gap-1.5"
                                        onClick={() => setSelectedCardId(link.linkedCardId!)}
                                        title={`Open card #${link.linkedCardId}`}
                                      >
                                        <span className="truncate">{link.title}</span>
                                        <ArrowUpRight className="w-3 h-3 shrink-0 opacity-50" />
                                      </button>
                                    ) : (
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 truncate"
                                        title={link.url}
                                      >
                                        <span className="truncate">{link.title}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                                      </a>
                                    )}
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {isCardLink ? `Card #${link.linkedCardId}` : link.url}
                                    </p>
                                  </div>

                                  {isAdmin && (
                                    <button
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                      onClick={() => handleDeleteLink(link.id)}
                                      aria-label="Remove link"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                            No links yet.{isAdmin && " Click \"Add Link\" to attach a URL or card."}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* ── Attachments ───────────────────────────────────────── */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-primary" /> Attachments
                            {attachments.length > 0 && (
                              <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>
                            )}
                          </Label>
                          {isAdmin && !isNew && (
                            <>
                              <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
                                onChange={handleFileUpload}
                              />
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}>
                                {uploading ? "Uploading…" : <><Plus className="w-3 h-3" /> Attach File</>}
                              </Button>
                            </>
                          )}
                        </div>

                        {loadingAttachments ? (
                          <Skeleton className="h-10 rounded" />
                        ) : attachments.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                            No files attached.{isAdmin && !isNew && " Click \"Attach File\" to upload."}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {attachments.map(att => (
                              <div key={att.id}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card group hover:bg-muted/20 transition-colors">
                                <div className="shrink-0">{attachmentIcon(att.mimeType)}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{att.originalName}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatBytes(att.fileSize)}
                                  </p>
                                </div>
                                <a
                                  href={`${BASE}/api/attachments/${att.filename}`}
                                  download={att.originalName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                  title="Download">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteAttachment(att)}
                                    className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    title="Remove">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* ── Data Source & Cohort Tags ─────────────────────────── */}
                      <div className="space-y-3">
                        <Label className="font-semibold text-sm flex items-center gap-2">
                          <Database className="w-4 h-4 text-primary" /> Data Source &amp; Cohort Tags
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Database className="w-3 h-3" /> Data Source
                            </Label>
                            <Select
                              value={tagDataSource || "__none__"}
                              onValueChange={v => setTagDataSource(v === "__none__" ? "" : v)}
                              disabled={!isAdmin || isNew}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {dataSources.map(ds => (
                                  <SelectItem key={ds.id} value={ds.name}>{ds.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <FilterIcon className="w-3 h-3" /> Cohort/Era
                            </Label>
                            <Select
                              value={tagCohort || "__none__"}
                              onValueChange={v => setTagCohort(v === "__none__" ? "" : v)}
                              disabled={!isAdmin || isNew}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {cohorts.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {isAdmin && !isNew && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={handleSaveTags} disabled={savingTags}>
                            {savingTags ? "Saving…" : "Save Tags"}
                          </Button>
                        )}
                      </div>

                      <Separator />

                      {/* ── Deliverables & Publications ───────────────────────── */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" /> Deliverables &amp; Publications
                            {deliverables.length > 0 && (
                              <span className="text-xs font-normal text-muted-foreground">({deliverables.length})</span>
                            )}
                          </Label>
                          {isAdmin && !isNew && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                              onClick={openDeliverableCreate}>
                              <Plus className="w-3 h-3" /> Add
                            </Button>
                          )}
                        </div>

                        {loadingDeliverables ? (
                          <div className="space-y-2">
                            <Skeleton className="h-10 rounded" />
                            <Skeleton className="h-10 rounded" />
                          </div>
                        ) : deliverables.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                            No deliverables yet.{isAdmin && !isNew && " Click \"Add\" to track a manuscript, report, or product."}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {deliverables.map(d => {
                              const statusColors: Record<string, string> = {
                                drafting: "bg-slate-100 text-slate-600",
                                submitted: "bg-amber-100 text-amber-700",
                                accepted: "bg-blue-100 text-blue-700",
                                published: "bg-green-100 text-green-700",
                              };
                              return (
                                <div key={d.id}
                                  className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                                  <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium truncate">{d.title}</span>
                                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusColors[d.status] ?? "bg-muted text-muted-foreground")}>
                                        {d.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                      {d.journal && <span className="italic">{d.journal}</span>}
                                      {d.firstAuthor && <span>{d.firstAuthor}</span>}
                                      {d.targetDate && <span>Target: {d.targetDate}</span>}
                                      {d.doi && (
                                        <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noopener noreferrer"
                                          className="text-primary hover:underline flex items-center gap-0.5">
                                          <ExternalLink className="w-3 h-3" /> DOI
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                        onClick={() => openDeliverableEdit(d)}>
                                        <Tags className="w-3 h-3" />
                                      </button>
                                      <button className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                        onClick={() => handleDeleteDeliverable(d.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Deliverable form dialog */}
                      {showDeliverableForm && (
                        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => setShowDeliverableForm(false)}>
                          <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
                            <h3 className="font-semibold text-base flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-primary" />
                              {editingDeliverable ? "Edit Deliverable" : "Add Deliverable"}
                            </h3>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Title *</Label>
                                <Input value={deliverableForm.title}
                                  onChange={e => setDeliverableForm(f => ({ ...f, title: e.target.value }))}
                                  placeholder="Full title of manuscript/report" className="h-8 text-sm" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Select value={deliverableForm.type}
                                    onValueChange={v => setDeliverableForm(f => ({ ...f, type: v }))}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {DELIVERABLE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Status</Label>
                                  <Select value={deliverableForm.status}
                                    onValueChange={v => setDeliverableForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {DELIVERABLE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">First Author</Label>
                                  <Input value={deliverableForm.firstAuthor}
                                    onChange={e => setDeliverableForm(f => ({ ...f, firstAuthor: e.target.value }))}
                                    placeholder="Last, First" className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Journal / Venue</Label>
                                  <Input value={deliverableForm.journal}
                                    onChange={e => setDeliverableForm(f => ({ ...f, journal: e.target.value }))}
                                    placeholder="Journal name" className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Target Date</Label>
                                  <Input type="date" value={deliverableForm.targetDate}
                                    onChange={e => setDeliverableForm(f => ({ ...f, targetDate: e.target.value }))}
                                    className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Published Year</Label>
                                  <Input type="number" value={deliverableForm.publishedYear}
                                    onChange={e => setDeliverableForm(f => ({ ...f, publishedYear: e.target.value }))}
                                    placeholder="e.g. 2024" min="2000" max="2035" className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">DOI</Label>
                                <Input value={deliverableForm.doi}
                                  onChange={e => setDeliverableForm(f => ({ ...f, doi: e.target.value }))}
                                  placeholder="10.xxxx/xxxxx" className="h-8 text-sm" />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={() => setShowDeliverableForm(false)}>Cancel</Button>
                              <Button size="sm" onClick={handleSaveDeliverable}
                                disabled={savingDeliverable || !deliverableForm.title}>
                                {savingDeliverable ? "Saving…" : editingDeliverable ? "Save Changes" : "Add Deliverable"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Activity & Notes */}
                      <div className="space-y-4">
                        <Label className="font-semibold text-sm flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-primary" /> Updates & Notes
                        </Label>

                        <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs mt-1">
                            ME
                          </div>
                          <div className="flex-1 space-y-2">
                            <Textarea
                              value={newNote}
                              onChange={e => setNewNote(e.target.value)}
                              placeholder="Write an update..."
                              className="min-h-[80px] text-sm bg-muted/20"
                            />
                            <div className="flex justify-end">
                              <Button size="sm" onClick={submitNote} disabled={!newNote.trim()}>
                                <Send className="w-3 h-3 mr-2" /> Post
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 mt-6">
                          {notes?.map((note, index) => (
                            <div key={note.id} className="flex gap-3 relative">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium z-10 border bg-card">
                                {note.authorName.charAt(0)}
                              </div>
                              {index !== notes.length - 1 && (
                                <div className="absolute top-8 left-4 w-px h-full bg-border -ml-px z-0" />
                              )}
                              <div className="flex-1 bg-muted/30 border border-border/50 rounded-lg p-3 space-y-1 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium text-sm">{note.authorName}</span>
                                  <span className="text-xs text-muted-foreground">{format(new Date(note.createdAt), "MMM d, h:mm a")}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <Skeleton className="h-8 w-1/2" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <Skeleton className="h-32 w-full" />
                </div>
              )}
            </ScrollArea>

            {isNew && (
              <div className="p-4 border-t bg-card mt-auto shrink-0 flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleCreate}>Create Card</Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add Link Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" /> Add Link
            </DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                linkMode === "url"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLinkMode("url")}
            >
              <Globe className="w-3.5 h-3.5" /> External URL
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                linkMode === "card"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLinkMode("card")}
            >
              <Layers className="w-3.5 h-3.5" /> Card Reference
            </button>
          </div>

          <div className="space-y-4 py-2">
            {linkMode === "url" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="link-title" className="text-sm font-medium">
                    Link Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="link-title"
                    placeholder="e.g. GitHub PR #42, Design Doc, Jira Ticket"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link-url" className="text-sm font-medium">
                    URL <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="link-url"
                      placeholder="https://"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      className="pl-9"
                      onKeyDown={e => e.key === "Enter" && handleSubmitLink()}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Select a card <span className="text-destructive">*</span>
                  </Label>
                  {linkCardId ? (
                    // Selected card preview
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/30">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {allCards?.find(c => c.id === linkCardId)?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">Card #{linkCardId}</p>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setLinkCardId(null); setLinkTitle(""); }}
                        aria-label="Change card"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    // Card search
                    <Command className="border rounded-lg shadow-sm">
                      <CommandInput
                        placeholder="Search by title or #ID…"
                        value={cardSearch}
                        onValueChange={setCardSearch}
                      />
                      <CommandList className="max-h-52">
                        <CommandEmpty>No cards found.</CommandEmpty>
                        <CommandGroup>
                          {filteredCards.slice(0, 30).map(c => {
                            const member = allMembers?.find(m => m.id === c.assigneeId);
                            return (
                              <CommandItem
                                key={c.id}
                                value={`${c.id} ${c.title}`}
                                onSelect={() => {
                                  setLinkCardId(c.id);
                                  setLinkTitle(c.title);
                                  setCardSearch("");
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 w-full">
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                                    STATUS_COLORS[c.status] ?? "bg-muted"
                                  )}>
                                    {c.status.replace("_", " ")}
                                  </span>
                                  <span className="flex-1 truncate text-sm">{c.title}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {member ? member.name : "Unassigned"} · #{c.id}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                </div>

                {linkCardId && (
                  <div className="space-y-1.5">
                    <Label htmlFor="link-label" className="text-sm font-medium">
                      Label <span className="text-xs text-muted-foreground font-normal">(optional — uses card title by default)</span>
                    </Label>
                    <Input
                      id="link-label"
                      placeholder={allCards?.find(c => c.id === linkCardId)?.title}
                      value={linkTitle}
                      onChange={e => setLinkTitle(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitLink}
              disabled={linkSaving || (linkMode === "url" ? (!linkTitle.trim() || !linkUrl.trim()) : !linkCardId)}
            >
              {linkSaving ? "Adding…" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dependency search dialog ──────────────────────────── */}
      <Dialog open={showDepDialog} onOpenChange={o => { setShowDepDialog(o); if (!o) setDepSearch(""); }}>
        <DialogContent className="sm:max-w-sm p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" /> Add Dependency — Blocked By
            </DialogTitle>
          </DialogHeader>
          <div className="px-3 pb-3">
            <p className="text-xs text-muted-foreground mb-2">
              Select a card that must be completed before this one can proceed.
            </p>
            <Command>
              <CommandInput
                placeholder="Search cards…"
                value={depSearch}
                onValueChange={setDepSearch}
                className="h-9 text-sm"
              />
              <CommandList className="max-h-52">
                <CommandEmpty>No matching cards found.</CommandEmpty>
                <CommandGroup>
                  {allCards
                    ?.filter(c =>
                      c.id !== selectedCardId &&
                      !deps.some(d => d.dependsOnCardId === c.id) &&
                      (!depSearch.trim() || c.title.toLowerCase().includes(depSearch.toLowerCase()))
                    )
                    .slice(0, 25)
                    .map(c => (
                      <CommandItem
                        key={c.id}
                        value={String(c.id)}
                        onSelect={() => addDep(c.id)}
                        className="text-sm gap-2 cursor-pointer"
                      >
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                          STATUS_COLORS[c.status] ?? "bg-muted"
                        )}>
                          {c.status.replace("_", " ")}
                        </span>
                        <span className="flex-1 truncate">{c.title}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
