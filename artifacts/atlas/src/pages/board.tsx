import React, { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useListTeams,
  useListMembers,
  useListCards,
  useMoveCard,
  useUpdateCard,
  useGenerateTeamColumnSummary,
  getListCardsQueryKey,
  useGetTeam
} from "@workspace/api-client-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, MoreHorizontal, MessageSquare, CheckSquare, Link as LinkIcon,
  BarChart, Bot, CalendarClock, ChartGantt, ArrowRightLeft, ExternalLink,
  ChevronDown, ChevronUp, Sparkles, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card as CardUI, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import AnalystGanttPanel from "@/components/analyst-gantt-panel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-600"
};

const statusColors = {
  not_started: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-primary/20 text-primary",
  blocked: "bg-destructive/20 text-destructive",
  in_review: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  done: "bg-green-500/20 text-green-700 dark:text-green-400"
};

export default function Board() {
  const { teamSlug } = useParams();
  const queryClient = useQueryClient();
  const { role, setSelectedCardId } = useAppStore();
  const { toast } = useToast();
  const [activeGanttMember, setActiveGanttMember] = useState<{ id: number; name: string } | null>(null);

  // ── Per-card expand state ──────────────────────────────────────────────────
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [cardAiSummaries, setCardAiSummaries] = useState<Record<number, string>>({});
  const [aiLoadingCard, setAiLoadingCard] = useState<number | null>(null);

  const toggleCardExpand = useCallback((cardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  }, []);

  const fetchCardAiSummary = useCallback(async (cardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiLoadingCard !== null) return;
    setAiLoadingCard(cardId);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/ai/card-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setCardAiSummaries(prev => ({ ...prev, [cardId]: data.summary }));
        }
      }
    } catch {
      // silent
    } finally {
      setAiLoadingCard(null);
    }
  }, [aiLoadingCard]);

  // Find team by slug
  const { data: teams } = useListTeams();
  const team = useMemo(() => teams?.find(t => t.slug === teamSlug), [teams, teamSlug]);
  const teamId = team?.id;

  const { data: members, isLoading: loadingMembers } = useListMembers(
    { teamId },
    { query: { enabled: !!teamId } }
  );
  const { data: cards, isLoading: loadingCards } = useListCards(
    { teamId },
    { query: { enabled: !!teamId } }
  );

  const moveCardMutation = useMoveCard();
  const generateSummaryMutation = useGenerateTeamColumnSummary();

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || !teamId) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const cardId = parseInt(result.draggableId);
    const newAssigneeId = destination.droppableId === "unassigned"
      ? null
      : parseInt(destination.droppableId);

    queryClient.setQueryData(getListCardsQueryKey({ teamId }), (old: any[]) => {
      if (!old) return old;
      const others = old.filter(c => c.id !== cardId);
      const moved = old.find(c => c.id === cardId);
      if (!moved) return old;
      const updatedMoved = { ...moved, assigneeId: newAssigneeId, position: destination.index };
      const destColCards = others
        .filter(c => c.assigneeId === newAssigneeId)
        .sort((a, b) => a.position - b.position);
      destColCards.splice(destination.index, 0, updatedMoved);
      const destUpdated = destColCards.map((c, i) => ({ ...c, position: i }));
      const srcAssigneeId = source.droppableId === "unassigned" ? null : parseInt(source.droppableId);
      const srcColCards = others
        .filter(c => c.assigneeId === srcAssigneeId && c.assigneeId !== newAssigneeId)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ ...c, position: i }));
      const untouched = others.filter(c =>
        c.assigneeId !== newAssigneeId && c.assigneeId !== srcAssigneeId
      );
      return [...untouched, ...srcColCards, ...destUpdated];
    });

    moveCardMutation.mutate(
      { cardId, data: { teamId, assigneeId: newAssigneeId, position: destination.index } },
      {
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getListCardsQueryKey({ teamId }) });
          toast({ title: "Failed to move card", variant: "destructive" });
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCardsQueryKey({ teamId }) });
        }
      }
    );
  }, [teamId, queryClient, moveCardMutation, toast]);

  // Cross-team move
  const handleMoveToTeam = useCallback((cardId: number, targetTeamId: number) => {
    if (!teamId) return;
    moveCardMutation.mutate(
      { cardId, data: { teamId: targetTeamId, position: 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCardsQueryKey({ teamId }) });
          const targetTeam = teams?.find(t => t.id === targetTeamId);
          toast({ title: `Card moved to ${targetTeam?.name ?? "team"}` });
        },
        onError: () => toast({ title: "Failed to move card", variant: "destructive" })
      }
    );
  }, [teamId, teams, queryClient, moveCardMutation, toast]);

  const handleGenerateSummaries = () => {
    if (!teamId) return;
    generateSummaryMutation.mutate({ data: { teamId } });
  };

  // Group cards by assignee
  const columns = useMemo(() => {
    if (!members || !cards) return [];
    return [
      {
        id: "unassigned",
        title: "Unassigned",
        cards: cards.filter(c => !c.assigneeId).sort((a, b) => a.position - b.position)
      },
      ...members.sort((a, b) => a.position - b.position).map(m => ({
        id: m.id.toString(),
        title: m.name,
        cards: cards.filter(c => c.assigneeId === m.id).sort((a, b) => a.position - b.position)
      }))
    ];
  }, [members, cards]);

  const otherTeams = useMemo(() => teams?.filter(t => t.id !== teamId) ?? [], [teams, teamId]);

  if (!teamSlug) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Board header */}
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3">
          {team ? (
            <>
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: team.color }} />
              <h1 className="text-xl font-bold">{team.name} Board</h1>
              {team.description && (
                <span className="text-sm text-muted-foreground ml-2">{team.description}</span>
              )}
            </>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </div>
        <div className="flex items-center gap-3">
          {team && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/gantt/${team.id}`} className="flex items-center gap-2">
                <BarChart className="w-4 h-4" />
                Team Gantt
              </Link>
            </Button>
          )}
          {role === "admin" && (
            <Button size="sm" onClick={() => setSelectedCardId(-1)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Card
            </Button>
          )}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-6 inline-flex h-full min-h-[calc(100vh-140px)] gap-6 items-start">
            <DragDropContext onDragEnd={handleDragEnd}>
              {loadingMembers || loadingCards ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[320px] shrink-0 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ))
              ) : columns.map(col => (
                <div key={col.id} className="w-[340px] shrink-0 flex flex-col bg-muted/30 rounded-xl border p-3 max-h-full">
                  {/* Column header */}
                  <div className="font-semibold flex items-center justify-between px-1 mb-3">
                    <button
                      className={cn(
                        "flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        col.id !== "unassigned" && "cursor-pointer"
                      )}
                      onClick={() => {
                        if (col.id === "unassigned" || !teamId) return;
                        const memberId = parseInt(col.id);
                        setActiveGanttMember(
                          activeGanttMember?.id === memberId ? null : { id: memberId, name: col.title }
                        );
                      }}
                      disabled={col.id === "unassigned" || !teamId}
                      aria-label={col.id !== "unassigned" ? `Toggle Gantt for ${col.title}` : undefined}
                      aria-expanded={col.id !== "unassigned" && activeGanttMember?.id === parseInt(col.id)}
                    >
                      <span className="truncate max-w-[180px]">{col.title}</span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-xs">{col.cards.length}</Badge>
                      {col.id !== "unassigned" && (
                        <ChartGantt className={cn(
                          "w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity",
                          activeGanttMember?.id === parseInt(col.id) && "opacity-100 text-primary"
                        )} />
                      )}
                    </button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Card list (droppable) */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          "flex-1 overflow-y-auto space-y-3 min-h-[100px] px-1 rounded-lg transition-colors",
                          snapshot.isDraggingOver && "bg-muted/50"
                        )}
                      >
                        {col.cards.map((card, index) => {
                          const isExpanded = expandedCards.has(card.id);
                          const aiSummary = cardAiSummaries[card.id];
                          const isLoadingAi = aiLoadingCard === card.id;

                          return (
                            <Draggable key={card.id.toString()} draggableId={card.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={provided.draggableProps.style}
                                >
                                  <CardUI className={cn(
                                    "hover:border-primary/50 transition-colors shadow-sm cursor-grab active:cursor-grabbing group",
                                    snapshot.isDragging && "shadow-xl border-primary rotate-1"
                                  )}>
                                    {/* Drag handle — card header area */}
                                    <CardHeader className="p-3 pb-0 space-y-2" {...provided.dragHandleProps}>
                                      <div className="flex justify-between items-start">
                                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                          <Badge
                                            variant="secondary"
                                            className={cn("text-[10px] uppercase font-semibold border-none px-1.5", statusColors[card.status as keyof typeof statusColors])}
                                          >
                                            {card.status.replace("_", " ")}
                                          </Badge>
                                          {card.labels.map(l => (
                                            <div
                                              key={l.id}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-1 shadow-sm"
                                              style={{ backgroundColor: l.color }}
                                            >
                                              {l.name}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                          <div
                                            className={cn("w-2.5 h-2.5 rounded-full shadow-sm", priorityColors[card.priority as keyof typeof priorityColors])}
                                            title={`Priority: ${card.priority}`}
                                          />
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity w-5 h-5 flex items-center justify-center">
                                                <MoreHorizontal className="w-3 h-3" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
                                              <DropdownMenuItem onClick={() => setSelectedCardId(card.id)}>
                                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open card
                                              </DropdownMenuItem>
                                              {role === "admin" && otherTeams.length > 0 && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                      <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Move to team
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                      {otherTeams.map(t => (
                                                        <DropdownMenuItem
                                                          key={t.id}
                                                          onClick={() => handleMoveToTeam(card.id, t.id)}
                                                        >
                                                          <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: t.color }} />
                                                          {t.name}
                                                        </DropdownMenuItem>
                                                      ))}
                                                    </DropdownMenuSubContent>
                                                  </DropdownMenuSub>
                                                </>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                      <h3
                                        className="font-medium text-sm leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => setSelectedCardId(card.id)}
                                      >
                                        {card.title}
                                      </h3>
                                    </CardHeader>

                                    {/* Card body — notes + optional AI summary */}
                                    <CardContent
                                      className="p-3 pt-2 pb-1 cursor-pointer"
                                      onClick={() => setSelectedCardId(card.id)}
                                    >
                                      {card.latestNote && (
                                        <div className={cn(
                                          "text-xs text-muted-foreground bg-muted/50 p-2 rounded-md border border-border/50",
                                          !isExpanded && "line-clamp-2"
                                        )}>
                                          {card.latestNote}
                                        </div>
                                      )}

                                      {/* AI summary — only when expanded */}
                                      {isExpanded && (
                                        <div className="mt-2" onClick={e => e.stopPropagation()}>
                                          {isLoadingAi ? (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                              Generating summary…
                                            </div>
                                          ) : aiSummary ? (
                                            <p className="text-xs text-foreground/80 flex items-start gap-1 bg-primary/5 border border-primary/15 rounded-md p-2">
                                              <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                              {aiSummary}
                                            </p>
                                          ) : (
                                            <button
                                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5 w-full"
                                              onClick={e => fetchCardAiSummary(card.id, e)}
                                              disabled={aiLoadingCard !== null}
                                            >
                                              <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                              Generate AI one-liner
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </CardContent>

                                    {/* Expand / collapse toggle */}
                                    {(card.latestNote || isExpanded) && (
                                      <div className="px-3 pb-1.5 flex justify-end">
                                        <button
                                          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded px-1"
                                          onClick={e => toggleCardExpand(card.id, e)}
                                          title={isExpanded ? "Show less" : "Show more + AI"}
                                        >
                                          {isExpanded ? (
                                            <><ChevronUp className="w-3 h-3" /> less</>
                                          ) : (
                                            <><ChevronDown className="w-3 h-3" /> more</>
                                          )}
                                        </button>
                                      </div>
                                    )}

                                    <CardFooter
                                      className="p-3 pt-0 flex justify-between items-center text-xs text-muted-foreground cursor-pointer"
                                      onClick={() => setSelectedCardId(card.id)}
                                    >
                                      <div className="flex items-center gap-3">
                                        {card.dueDate && (
                                          <div className={cn(
                                            "flex items-center gap-1",
                                            new Date(card.dueDate) < new Date() && card.status !== "done" && "text-destructive font-medium"
                                          )}>
                                            <CalendarClock className="w-3.5 h-3.5" />
                                            {format(new Date(card.dueDate), "MMM d")}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                          {card.checklistTotal > 0 && (
                                            <div className={cn("flex items-center gap-1", card.checklistDone === card.checklistTotal && "text-green-600")}>
                                              <CheckSquare className="w-3.5 h-3.5" />
                                              <span>{card.checklistDone}/{card.checklistTotal}</span>
                                            </div>
                                          )}
                                          {card.commentCount > 0 && (
                                            <div className="flex items-center gap-1">
                                              <MessageSquare className="w-3.5 h-3.5" />
                                              <span>{card.commentCount}</span>
                                            </div>
                                          )}
                                          {card.links && card.links.length > 0 && (
                                            <div className="flex items-center gap-1">
                                              <LinkIcon className="w-3.5 h-3.5" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-[10px] uppercase font-mono opacity-50">#{card.id}</span>
                                    </CardFooter>
                                  </CardUI>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {role === "admin" && (
                          <button
                            className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg px-2 py-2 flex items-center gap-1.5 transition-colors mt-1"
                            onClick={() => setSelectedCardId(-1)}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add card
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </DragDropContext>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Analyst Gantt panel */}
      {activeGanttMember && teamId && (
        <div className="border-t shrink-0 bg-background z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="p-4">
            <AnalystGanttPanel
              teamId={teamId}
              memberId={activeGanttMember.id}
              memberName={activeGanttMember.name}
              onClose={() => setActiveGanttMember(null)}
            />
          </div>
        </div>
      )}

      {/* AI Column Summaries */}
      <div className="border-t bg-card p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> AI Column Summaries
          </h3>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={handleGenerateSummaries}
            disabled={generateSummaryMutation.isPending || !teamId}
          >
            {generateSummaryMutation.isPending ? "Generating..." : "Regenerate Summaries"}
          </Button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {team?.members?.map((member: any) => (
            <div key={member.memberId} className="min-w-[250px] flex-1 border rounded-md p-3 bg-muted/20">
              <div className="font-medium text-sm mb-1">{member.memberName}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {member.aiSummary || "No recent updates to summarize."}
              </p>
            </div>
          ))}
        </div>
      </div>

      <CardDetailDrawer />
    </div>
  );
}
