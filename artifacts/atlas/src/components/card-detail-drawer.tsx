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
  getGetCardQueryKey,
  getListNotesQueryKey,
  getListChecklistItemsQueryKey,
  getListCardsQueryKey,
  useCreateCard
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { CalendarIcon, MessageSquare, Plus, CheckSquare, Tags, Trash2, X, Send, AlertCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function CardDetailDrawer() {
  const { selectedCardId, setSelectedCardId, role } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isNew = selectedCardId === -1;
  const isOpen = selectedCardId !== null;

  // Data fetching
  const { data: card } = useGetCard(selectedCardId > 0 ? selectedCardId : 0, { 
    query: { enabled: selectedCardId > 0 } 
  });
  const { data: notes } = useListNotes(selectedCardId > 0 ? selectedCardId : 0, {
    query: { enabled: selectedCardId > 0 }
  });
  const { data: checklist } = useListChecklistItems(selectedCardId > 0 ? selectedCardId : 0, {
    query: { enabled: selectedCardId > 0 }
  });
  const { data: allLabels } = useListLabels();
  
  // Need team context for members/creating
  // For simplicity in this demo, if creating new, we might need teamId context. 
  // Getting from URL is tricky in a global drawer, so we'll fetch all members and filter later or just show all
  const { data: allMembers } = useListMembers();

  // Mutations
  const updateCard = useUpdateCard();
  const createCard = useCreateCard();
  const addLabel = useAddCardLabel();
  const removeLabel = useRemoveCardLabel();
  const createNote = useCreateNote();
  const createChecklist = useCreateChecklistItem();
  const updateChecklist = useUpdateChecklistItem();

  // Local state for auto-save/forms
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const initializedForId = useRef<number | null>(null);

  // Sync server data to local state
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

  const handleClose = () => {
    setSelectedCardId(null);
    initializedForId.current = null;
  };

  const handleTitleBlur = () => {
    if (isNew) return; // Handled by create button
    if (title !== card?.title && role === 'admin') {
      updateCard.mutate({ 
        cardId: card.id, 
        data: { title } 
      }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetCardQueryKey(card.id), (old: any) => ({...old, title}));
          queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
        }
      });
    }
  };

  const handleDescriptionBlur = () => {
    if (isNew) return;
    if (description !== card?.description && role === 'admin') {
      updateCard.mutate({ 
        cardId: card.id, 
        data: { description } 
      }, {
        onSuccess: () => {
          queryClient.setQueryData(getGetCardQueryKey(card.id), (old: any) => ({...old, description}));
        }
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
      data: { content: newNote, authorName: "Current User" } // hardcoded for demo
    }, {
      onSuccess: () => {
        setNewNote("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(card.id) });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() }); // Updates latest note on board
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
    updateChecklist.mutate({
      itemId: id,
      data: { done: !done }
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChecklistItemsQueryKey(card.id) })
    });
  };

  const handleCreate = () => {
    // Basic validation
    if (!title) return toast({ title: "Title required", variant: "destructive" });
    
    // Hardcode teamId 1 for demo if creating globally, or get from URL in a real app
    createCard.mutate({
      data: {
        teamId: 1, 
        title,
        description,
        status: "not_started",
        priority: "medium"
      }
    }, {
      onSuccess: (newCard) => {
        toast({ title: "Card created" });
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
        setSelectedCardId(newCard.id); // switch to edit mode
      }
    });
  };

  const isAdmin = role === 'admin';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col h-full bg-background border-l shadow-2xl">
        <div className="flex-1 overflow-hidden flex flex-col h-full">
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
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><CheckSquare className="w-3 h-3"/> Status</Label>
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
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Priority</Label>
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
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3"/> Assignee</Label>
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
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> Due Date</Label>
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
  );
}

