import React, { useState } from "react";
import { useGetDashboardSummary, useGetTeamSummaries, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Activity, AlertCircle, CheckCircle2, Clock, Layers, Users, Kanban, Columns, ChevronRight, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import AnalystGanttPanel from "@/components/analyst-gantt-panel";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: teams, isLoading: loadingTeams } = useGetTeamSummaries();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });
  // key = `${teamId}-${memberId}`
  const [openGanttKey, setOpenGanttKey] = useState<string | null>(null);

  const toggleGantt = (teamId: number, memberId: number) => {
    const key = `${teamId}-${memberId}`;
    setOpenGanttKey(prev => (prev === key ? null : key));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all data science groups and projects.</p>
      </div>

      {loadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCards}</div>
              <p className="text-xs text-muted-foreground">{summary.done} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.inProgress}</div>
              <p className="text-xs text-muted-foreground">{summary.dueThisWeek} due this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Blocked / Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.blocked + summary.overdue}</div>
              <p className="text-xs text-destructive/80">{summary.blocked} blocked, {summary.overdue} overdue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teams & Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTeams}</div>
              <p className="text-xs text-muted-foreground">{summary.totalMembers} active members</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Team Status</CardTitle>
              <CardDescription>Current breakdown of projects by team</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTeams ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : teams ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Not Started</TableHead>
                      <TableHead className="text-right">In Progress</TableHead>
                      <TableHead className="text-right">Blocked</TableHead>
                      <TableHead className="text-right">Done</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.teamId}>
                        <TableCell className="font-medium">
                          <Link href={`/board/${team.teamSlug}`} className="hover:underline flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.teamColor }} />
                            {team.teamName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{team.totalCards}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{team.notStarted}</TableCell>
                        <TableCell className="text-right text-primary">{team.inProgress}</TableCell>
                        <TableCell className="text-right text-destructive">{team.blocked}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">{team.done}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Team Analyst Summaries</h3>
            {teams?.map(team => (
              <Card key={`ai-${team.teamId}`}>
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.teamColor }} />
                      {team.teamName} Analysts
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableBody>
                      {team.members.map(member => {
                        const ganttKey = `${team.teamId}-${member.memberId}`;
                        const isOpen = openGanttKey === ganttKey;
                        return (
                          <React.Fragment key={member.memberId}>
                            <TableRow
                              className="group cursor-pointer hover:bg-muted/40 transition-colors"
                              onClick={() => toggleGantt(team.teamId, member.memberId)}
                              aria-expanded={isOpen}
                              role="button"
                            >
                              <TableCell className="w-[200px]">
                                <div className="flex items-center gap-2 font-medium">
                                  {isOpen
                                    ? <ChevronDown className="w-4 h-4 text-primary shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
                                  }
                                  <span className={isOpen ? "text-primary" : ""}>{member.memberName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {member.aiSummary ? (
                                  <span className="text-sm text-muted-foreground">{member.aiSummary}</span>
                                ) : (
                                  <span className="text-sm italic text-muted-foreground/50">No recent notes</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right w-[150px]">
                                {member.cardCount > 0 ? (
                                  <Badge variant="outline" className="font-normal">
                                    {member.done}/{member.cardCount} Done
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Empty</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={3} className="p-3 bg-muted/20">
                                  <AnalystGanttPanel
                                    teamId={team.teamId}
                                    memberId={member.memberId}
                                    memberName={member.memberName}
                                    onClose={() => setOpenGanttKey(null)}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Card className="h-full max-h-[800px] flex flex-col">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across all teams</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6 pb-6">
                {loadingActivity ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="space-y-2 w-full">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activity && activity.length > 0 ? (
                  <div className="space-y-6">
                    {activity.map((event) => (
                      <div key={event.id} className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border shadow-sm z-10">
                          {event.eventType.includes('create') ? <Activity className="w-4 h-4 text-primary" /> : 
                           event.eventType.includes('update') ? <Kanban className="w-4 h-4 text-accent-foreground" /> :
                           event.eventType.includes('delete') ? <AlertCircle className="w-4 h-4 text-destructive" /> :
                           <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        {/* Timeline connecting line */}
                        <div className="absolute top-8 left-4 w-px h-full bg-border -ml-px z-0" />
                        
                        <div className="space-y-1 pb-4">
                          <p className="text-sm">
                            <span className="font-semibold">{event.actorName}</span>{" "}
                            {event.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No recent activity found.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
