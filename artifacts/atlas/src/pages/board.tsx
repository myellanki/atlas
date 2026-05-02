import React, { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { 
  useListTeams, 
  useListMembers, 
  useListCards, 
  useMoveCard, 
  useUpdateCard,
  useGenerateTeamColumnSummary,
  getGetDashboardSummaryQueryKey,
  getListCardsQueryKey,
  useGetTeam
} from "@workspace/api-client-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, MessageSquare, CheckSquare, Link as LinkIcon, BarChart, Bot, ExternalLink, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card as CardUI, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  
  // Find team by slug
  const { data: teams } = useListTeams();
  const team = useMemo(() => teams?.find(t => t.slug === teamSlug), [teams, teamSlug]);
  const teamId = team?.id;

  // Load members and cards
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !teamId) return;

    const sourceColId = result.source.droppableId;
    const destColId = result.destination.droppableId;
    const cardId = parseInt(result.draggableId);
    
    // Optimistic update logic could go here
    
    // Convert unassigned string to null, or keep number
    const newAssigneeId = destColId === "unassigned" ? null : parseInt(destColId);

    moveCardMutation.mutate({
      data: {
        teamId: teamId,
        assigneeId: newAssigneeId,
        position: result.destination.index
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey({ teamId }) });
      }
    });
  };

  const handleGenerateSummaries = () => {
    if (!teamId) return;
    generateSummaryMutation.mutate({ data: { teamId } });
    // In a real app we might poll or invalidate a specific query to refresh summaries
  };

  // Group cards by assignee
  const columns = useMemo(() => {
    if (!members || !cards) return [];
    
    const cols = [
      { id: "unassigned", title: "Unassigned", cards: cards.filter(c => !c.assigneeId).sort((a, b) => a.position - b.position) },
      ...members.sort((a, b) => a.position - b.position).map(m => ({
        id: m.id.toString(),
        title: m.name,
        cards: cards.filter(c => c.assigneeId === m.id).sort((a, b) => a.position - b.position)
      }))
    ];
    return cols;
  }, [members, cards]);

  if (!teamSlug) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3">
          {team ? (
            <>
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: team.color }} />
              <h1 className="text-xl font-bold">{team.name} Board</h1>
              {team.description && <span className="text-sm text-muted-foreground ml-2">{team.description}</span>}
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
                  <div className="font-semibold flex items-center justify-between px-1 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{col.title}</span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-xs">{col.cards.length}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                        className={cn(
                          "flex-1 overflow-y-auto space-y-3 min-h-[100px] px-1",
                          snapshot.isDraggingOver && "bg-muted/50 rounded-lg"
                        )}
                      >
                        {col.cards.map((card, index) => (
                          <Draggable key={card.id.toString()} draggableId={card.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedCardId(card.id)}
                                style={provided.draggableProps.style}
                              >
                                <CardUI className={cn(
                                  "cursor-pointer hover:border-primary/50 transition-colors shadow-sm",
                                  snapshot.isDragging && "shadow-xl border-primary"
                                )}>
                                  <CardHeader className="p-3 pb-0 space-y-2">
                                    <div className="flex justify-between items-start">
                                      <div className="flex flex-wrap gap-1.5">
                                        <Badge variant="secondary" className={cn("text-[10px] uppercase font-semibold border-none px-1.5", statusColors[card.status])}>
                                          {card.status.replace("_", " ")}
                                        </Badge>
                                        {card.labels.map(l => (
                                          <div key={l.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-1 shadow-sm" style={{ backgroundColor: l.color }}>
                                            {l.name}
                                          </div>
                                        ))}
                                      </div>
                                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", priorityColors[card.priority])} title={`Priority: ${card.priority}`} />
                                    </div>
                                    <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                      {card.title}
                                    </h3>
                                  </CardHeader>
                                  <CardContent className="p-3 pt-2 pb-2">
                                    {card.latestNote && (
                                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md line-clamp-2 border border-border/50">
                                        {card.latestNote}
                                      </div>
                                    )}
                                  </CardContent>
                                  <CardFooter className="p-3 pt-0 flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                      {card.dueDate && (
                                        <div className={cn(
                                          "flex items-center gap-1", 
                                          new Date(card.dueDate) < new Date() && card.status !== 'done' && "text-destructive font-medium"
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
                        ))}
                        {provided.placeholder}
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

      <div className="border-t bg-card p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> AI Column Summaries
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs" 
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
