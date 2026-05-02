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
  Send, AlertCircle, Users, Link2, ExternalLink, ArrowUpRight, Globe, Layers
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
                <div className="flex flex-wrap gap-2 mt-3">
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
    </>
  );
}
