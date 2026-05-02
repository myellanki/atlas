import React, { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetTeamGantt, useGetTeam } from "@workspace/api-client-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, addDays, isBefore, isAfter, startOfDay } from "date-fns";
import { useAppStore } from "@/lib/store";
import CardDetailDrawer from "@/components/card-detail-drawer";
import { cn } from "@/lib/utils";

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-600"
};

export default function Gantt() {
  const { teamId: teamIdStr } = useParams();
  const teamId = teamIdStr ? parseInt(teamIdStr) : 0;
  const { setSelectedCardId } = useAppStore();
  
  const { data: team } = useGetTeam(teamId, { query: { enabled: !!teamId } });
  const { data: ganttData, isLoading } = useGetTeamGantt(teamId, { query: { enabled: !!teamId } });

  const [zoom, setZoom] = React.useState(1);
  const dayWidth = 40 * zoom;

  // Calculate timeline range based on all bars
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!ganttData?.allBars.length) {
      const today = startOfDay(new Date());
      return { 
        minDate: addDays(today, -7), 
        maxDate: addDays(today, 21), 
        totalDays: 28 
      };
    }

    let min = new Date();
    let max = new Date();
    
    ganttData.allBars.forEach(bar => {
      if (bar.startDate) {
        const d = new Date(bar.startDate);
        if (d < min) min = d;
      }
      if (bar.dueDate) {
        const d = new Date(bar.dueDate);
        if (d > max) max = d;
      }
    });

    // Add padding
    min = addDays(min, -7);
    max = addDays(max, 14);
    
    return { minDate: startOfDay(min), maxDate: startOfDay(max), totalDays: differenceInDays(max, min) };
  }, [ganttData]);

  const days = useMemo(() => {
    return Array.from({ length: totalDays + 1 }).map((_, i) => addDays(minDate, i));
  }, [minDate, totalDays]);

  const getBarStyles = (bar: any) => {
    const start = bar.startDate ? new Date(bar.startDate) : new Date();
    const due = bar.dueDate ? new Date(bar.dueDate) : addDays(start, 1);
    
    const leftDays = Math.max(0, differenceInDays(start, minDate));
    const widthDays = Math.max(1, differenceInDays(due, start));
    
    return {
      left: `${leftDays * dayWidth}px`,
      width: `${widthDays * dayWidth}px`,
    };
  };

  const today = startOfDay(new Date());
  const todayOffset = differenceInDays(today, minDate) * dayWidth;

  if (!teamId) return null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href={team ? `/board/${team.slug}` : "/"}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          {team ? (
            <>
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: team.color }} />
              <h1 className="text-xl font-bold">{team.name} Timeline</h1>
            </>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="w-4 h-4 mr-1" /> Zoom Out
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
            <ZoomIn className="w-4 h-4 mr-1" /> Zoom In
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Names */}
        <div className="w-64 border-r bg-card flex flex-col shrink-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
          <div className="h-16 border-b flex items-end p-4 font-semibold text-sm text-muted-foreground shrink-0 bg-muted/20">
            Analyst
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-border/50">
                  <Skeleton className="h-5 w-32" />
                </div>
              ))
            ) : ganttData?.members.map(member => (
              <div key={member.memberId} className="px-4 py-3 h-[100px] border-b border-border/50 flex flex-col justify-center">
                <span className="font-medium">{member.memberName}</span>
                <span className="text-xs text-muted-foreground">{member.bars.length} cards</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Canvas - Timeline */}
        <ScrollArea className="flex-1">
          <div className="relative" style={{ width: `${(totalDays + 1) * dayWidth}px` }}>
            
            {/* Time Header */}
            <div className="h-16 border-b flex items-end relative shrink-0 bg-muted/20 sticky top-0 z-10">
              {days.map((day, i) => {
                const isFirstOfMonth = day.getDate() === 1;
                const isToday = differenceInDays(day, today) === 0;
                return (
                  <div 
                    key={i} 
                    className="absolute bottom-0 border-l border-border/50 h-8 flex items-end pb-1 px-1 text-[10px] text-muted-foreground"
                    style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                  >
                    {isFirstOfMonth ? (
                      <span className="font-bold text-foreground">{format(day, "MMM d")}</span>
                    ) : (
                      <span className={cn(isToday && "text-primary font-bold")}>{format(day, "d")}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Canvas Body */}
            <div className="relative min-h-[calc(100vh-140px)]">
              {/* Background grid */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                {days.map((day, i) => (
                  <div 
                    key={i} 
                    className="absolute top-0 bottom-0 border-l border-border"
                    style={{ left: `${i * dayWidth}px` }}
                  />
                ))}
              </div>

              {/* Today Line */}
              {todayOffset >= 0 && todayOffset <= totalDays * dayWidth && (
                <div 
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${todayOffset}px` }}
                >
                  <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
                </div>
              )}

              {/* Rows */}
              <div className="py-2">
                {ganttData?.members.map(member => (
                  <div key={member.memberId} className="h-[100px] border-b border-border/50 relative group hover:bg-muted/10 transition-colors">
                    {member.bars.map((bar, index) => {
                      const styles = getBarStyles(bar);
                      const isOverdue = bar.dueDate && new Date(bar.dueDate) < today && bar.status !== 'done';
                      // Distribute bars vertically within the row to avoid overlap if needed, simple logic here
                      const topOffset = 10 + (index % 3) * 28;
                      
                      return (
                        <div
                          key={bar.cardId}
                          className={cn(
                            "absolute h-6 rounded-md shadow-sm border cursor-pointer flex items-center px-2 text-xs truncate transition-all hover:brightness-110",
                            isOverdue && "border-red-500 border-2 ring-2 ring-red-500/20",
                            bar.status === 'done' ? "bg-muted border-border text-muted-foreground opacity-60" : "bg-card border-border/50 text-card-foreground hover:shadow-md"
                          )}
                          style={{ ...styles, top: `${topOffset}px` }}
                          onClick={() => setSelectedCardId(bar.cardId)}
                          title={`${bar.title}\nDue: ${bar.dueDate ? format(new Date(bar.dueDate), 'MMM d, yyyy') : 'No date'}`}
                        >
                          <div className={cn("w-2 h-2 rounded-full shrink-0 mr-2", priorityColors[bar.priority as keyof typeof priorityColors])} />
                          <span className="truncate">{bar.title}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      <CardDetailDrawer />
    </div>
  );
}
