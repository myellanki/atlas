import React, { useState, useMemo, useEffect } from "react";
import GlobalSearch from "@/components/global-search";
import { Link, useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import {
  useListTeams, useCreateTeam, getListTeamsQueryKey,
  useListCards
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
import {
  LayoutDashboard, Tags, Settings, UserCircle,
  Plus, CalendarDays, Layers, Bell, BellOff,
  AlertCircle, Clock, ChevronDown, ChevronRight, X,
  Flag, ClipboardList, BookOpen, Users, Flame, Tag,
  Search, ShieldCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarProvider, SidebarTrigger
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isToday, isPast, parseISO } from "date-fns";

const TEAM_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { role, setRole, setSelectedCardId } = useAppStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const { data: teams } = useListTeams();
  const { data: allCards } = useListCards({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTeam = useCreateTeam();

  // Alerts panel state
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => { const r = await fetch(`${BASE}/api/notifications`); return r.json(); },
    refetchInterval: 30000,
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id: number) => {
    await fetch(`${BASE}/api/notifications/${id}/read`, { method: "PATCH" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  const markAllRead = async () => {
    await fetch(`${BASE}/api/notifications/read-all`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  const deleteNotification = async (id: number) => {
    await fetch(`${BASE}/api/notifications/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  // New team dialog state
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);
  const [teamDesc, setTeamDesc] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Compute urgent cards ────────────────────────────────────────────────────
  const urgentCards = useMemo(() => {
    if (!allCards) return [];
    return allCards.filter(c => {
      if (!c.dueDate || c.status === "done") return false;
      const d = parseISO(c.dueDate);
      return isPast(d) || isToday(d); // overdue or due today
    }).sort((a, b) => {
      // overdue first, then due today
      const aD = parseISO(a.dueDate!);
      const bD = parseISO(b.dueDate!);
      if (isPast(aD) && !isToday(aD) && isToday(bD)) return -1;
      if (isToday(aD) && isPast(bD) && !isToday(bD)) return 1;
      return aD.getTime() - bD.getTime();
    });
  }, [allCards]);

  const overdueCount = urgentCards.filter(c => {
    const d = parseISO(c.dueDate!);
    return isPast(d) && !isToday(d);
  }).length;
  const dueTodayCount = urgentCards.filter(c => isToday(parseISO(c.dueDate!))).length;
  const totalUrgent = urgentCards.length;

  // ── Team form handlers ──────────────────────────────────────────────────────
  const handleNameChange = (val: string) => {
    setTeamName(val);
    if (!slugEdited) setTeamSlug(slugify(val));
  };

  const handleSlugChange = (val: string) => {
    setTeamSlug(slugify(val));
    setSlugEdited(true);
  };

  const resetDialog = () => {
    setTeamName(""); setTeamSlug(""); setTeamColor(TEAM_COLORS[0]);
    setTeamDesc(""); setSlugEdited(false);
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !teamSlug.trim()) {
      toast({ title: "Name and slug are required", variant: "destructive" });
      return;
    }
    if (teams?.some(t => t.slug === teamSlug)) {
      toast({ title: "Slug already taken — try a different one", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const newTeam = await createTeam.mutateAsync({
        data: { name: teamName.trim(), slug: teamSlug, color: teamColor, description: teamDesc.trim() || undefined }
      });
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      setShowNewTeam(false);
      resetDialog();
      toast({ title: `Team "${newTeam.name}" created` });
      navigate(`/board/${newTeam.slug}`);
    } catch {
      toast({ title: "Failed to create team", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const pageTitle = location === "/" ? "Dashboard"
    : location === "/calendar" ? "Calendar"
      : location === "/projects" ? "Projects"
        : location === "/labels" ? "Labels"
          : location === "/settings" ? "Settings"
            : location === "/milestones" ? "Milestones"
              : location === "/templates" ? "Card Templates"
                : location === "/portfolio" ? "Portfolio — Utilization"
                  : location === "/capacity" ? "Capacity Heat Calendar"
                    : location === "/publications" ? "Publications"
                      : location === "/tag-settings" ? "Tag Settings"
                      : location === "/irb" ? "IRB & Regulatory Tracker"
                        : location.startsWith("/board/") ? `${location.split("/")[2]?.toUpperCase()} Board`
                        : location.startsWith("/gantt/") ? "Gantt"
                          : "Atlas";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="p-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
                A
              </div>
              <span className="font-semibold text-lg tracking-tight">Atlas</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="bg-sidebar flex flex-col h-full">
            {/* Overview nav */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider">
                Overview
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/"}>
                      <Link href="/" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/projects"}>
                      <Link href="/projects" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span>Projects</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/calendar"}>
                      <Link href="/calendar" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        <span>Calendar</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/labels"}>
                      <Link href="/labels" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Tags className="w-4 h-4" />
                        <span>Labels</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/milestones"}>
                      <Link href="/milestones" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Flag className="w-4 h-4" />
                        <span>Milestones</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/publications"}>
                      <Link href="/publications" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span>Publications</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/templates"}>
                      <Link href="/templates" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        <span>Card Templates</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/tag-settings"}>
                      <Link href="/tag-settings" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>Tag Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Compliance section */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider">
                Compliance
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/irb"}>
                      <Link href="/irb" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        <span>IRB Tracker</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Portfolio section */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider">
                Portfolio
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/portfolio"}>
                      <Link href="/portfolio" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Utilization</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/capacity"}>
                      <Link href="/capacity" className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        <span>Capacity</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Teams section */}
            <SidebarGroup>
              <div className="flex items-center justify-between pr-2">
                <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider mt-4">
                  Teams
                </SidebarGroupLabel>
                {role === "admin" && (
                  <button
                    onClick={() => setShowNewTeam(true)}
                    className="mt-4 p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                    title="Add new team"
                    aria-label="Add new team"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams?.map(team => (
                    <SidebarMenuItem key={team.id}>
                      <SidebarMenuButton asChild isActive={location === `/board/${team.slug}`}>
                        <Link href={`/board/${team.slug}`} className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                          <span className="truncate">{team.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {role === "admin" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
                        onClick={() => setShowNewTeam(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-sm">Add team…</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Spacer to push alerts to bottom */}
            <div className="flex-1" />

            {/* ── Alerts / Activity Feed ────────────────────────────────────── */}
            <SidebarGroup className="border-t border-sidebar-border pt-2 pb-2 mt-2">
              <button
                onClick={() => setAlertsOpen(o => !o)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  alertsOpen
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                aria-expanded={alertsOpen}
              >
                {totalUrgent > 0
                  ? <Bell className="w-4 h-4 shrink-0 text-destructive" />
                  : <BellOff className="w-4 h-4 shrink-0 text-muted-foreground" />
                }
                <span className="flex-1 text-left">Alerts</span>
                {totalUrgent > 0 && (
                  <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-white border-none">
                    {totalUrgent}
                  </Badge>
                )}
                {alertsOpen
                  ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                }
              </button>

              {alertsOpen && (
                <div className="mt-1 mx-1 rounded-lg border bg-sidebar-accent/40 overflow-hidden">
                  {totalUrgent === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      ✓ No overdue or due-today cards
                    </div>
                  ) : (
                    <>
                      {/* Summary line */}
                      <div className="px-3 py-2 flex gap-3 border-b bg-muted/30 text-xs">
                        {overdueCount > 0 && (
                          <span className="flex items-center gap-1 text-destructive font-medium">
                            <AlertCircle className="w-3 h-3" /> {overdueCount} overdue
                          </span>
                        )}
                        {dueTodayCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Clock className="w-3 h-3" /> {dueTodayCount} due today
                          </span>
                        )}
                      </div>

                      {/* Card list */}
                      <ScrollArea className="max-h-64">
                        <div className="py-1">
                          {urgentCards.map(card => {
                            const d = parseISO(card.dueDate!);
                            const isOverdue = isPast(d) && !isToday(d);
                            const dueToday = isToday(d);
                            return (
                              <button
                                key={card.id}
                                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-sidebar-accent transition-colors group"
                                onClick={() => { setSelectedCardId(card.id); setAlertsOpen(false); }}
                              >
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                                  isOverdue ? "bg-destructive" : "bg-amber-500"
                                )} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate text-sidebar-foreground group-hover:text-primary transition-colors">
                                    {card.title}
                                  </p>
                                  <p className={cn(
                                    "text-[10px] mt-0.5 font-medium",
                                    isOverdue ? "text-destructive" : "text-amber-600"
                                  )}>
                                    {isOverdue
                                      ? `Overdue · ${format(d, "MMM d")}`
                                      : "Due today"
                                    }
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border mx-2" />
              <h2 className="text-sm font-medium text-muted-foreground">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Global search trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/40 hover:bg-muted text-sm text-muted-foreground transition-colors"
                title="Search (⌘K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Search…</span>
                <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] bg-background border rounded px-1 py-0.5 ml-1">⌘K</kbd>
              </button>

              {/* Notification bell */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Notifications">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <ScrollArea className="max-h-72">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8">No notifications</div>
                    ) : (
                      <div className="py-1">
                        {notifications.map((n: any) => (
                          <div
                            key={n.id}
                            onClick={() => !n.read && markRead(n.id)}
                            className={cn(
                              "flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0",
                              !n.read && "bg-primary/5"
                            )}
                          >
                            <div className={cn(
                              "w-2 h-2 rounded-full mt-1.5 shrink-0",
                              !n.read ? "bg-primary" : "bg-transparent border border-muted-foreground/30"
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-medium leading-snug", !n.read && "text-foreground")}>{n.title}</p>
                              {n.message && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>}
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {format(new Date(n.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                              className="shrink-0 p-0.5 rounded hover:text-destructive text-muted-foreground/40 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Compact alert badge in header (visible when sidebar is collapsed) */}
              {totalUrgent > 0 && (
                <button
                  className="flex items-center gap-1.5 text-sm text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-md transition-colors"
                  onClick={() => setAlertsOpen(o => !o)}
                  title={`${totalUrgent} urgent card${totalUrgent !== 1 ? "s" : ""}`}
                >
                  <Bell className="w-4 h-4" />
                  <span className="font-semibold text-xs">{totalUrgent}</span>
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-medium outline-none hover:bg-accent px-2 py-1.5 rounded-md transition-colors">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="capitalize">{role}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setRole("admin")} className="cursor-pointer">
                    <span className={role === "admin" ? "font-bold text-primary" : ""}>Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRole("member")} className="cursor-pointer">
                    <span className={role === "member" ? "font-bold text-primary" : ""}>Member</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="w-full flex items-center cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-background/50">
            {children}
          </main>
        </div>
      </div>

      <GlobalSearch open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* ── Add New Team Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showNewTeam} onOpenChange={open => { setShowNewTeam(open); if (!open) resetDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Create New Team
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                placeholder="e.g. Computer Vision, NLP Research…"
                value={teamName}
                onChange={e => handleNameChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team-slug">
                URL Slug <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">/board/</span>
                <Input
                  id="team-slug"
                  placeholder="e.g. cv-team"
                  value={teamSlug}
                  onChange={e => handleSlugChange(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              {teams?.some(t => t.slug === teamSlug) && teamSlug && (
                <p className="text-xs text-destructive">This slug is already taken.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Team Color</Label>
              <div className="flex gap-2 flex-wrap">
                {TEAM_COLORS.map(c => (
                  <button
                    key={c}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform hover:scale-110 border-2",
                      teamColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setTeamColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team-desc">
                Description <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="team-desc"
                placeholder="What does this team work on?"
                value={teamDesc}
                onChange={e => setTeamDesc(e.target.value)}
                className="min-h-[70px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewTeam(false); resetDialog(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim() || !teamSlug.trim() || teams?.some(t => t.slug === teamSlug)}
            >
              {creating ? "Creating…" : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
