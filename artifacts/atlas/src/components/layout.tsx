import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import { useListTeams, useCreateTeam, getListTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Tags, Settings, UserCircle,
  Plus, CalendarDays
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TEAM_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { role, setRole } = useAppStore();
  const { data: teams } = useListTeams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTeam = useCreateTeam();

  // New team dialog state
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);
  const [teamDesc, setTeamDesc] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleNameChange = (val: string) => {
    setTeamName(val);
    if (!slugEdited) {
      setTeamSlug(slugify(val));
    }
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
    // Check slug uniqueness client-side
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

          <SidebarContent className="bg-sidebar">
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
          </SidebarContent>
        </Sidebar>

        {/* Main area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border mx-2" />
              <h2 className="text-sm font-medium text-muted-foreground capitalize">
                {location === "/" ? "Dashboard"
                  : location === "/calendar" ? "Calendar"
                    : location === "/labels" ? "Labels"
                      : location === "/settings" ? "Settings"
                        : location.startsWith("/board/") ? `${location.split("/")[2]?.toUpperCase()} Board`
                          : location.startsWith("/gantt/") ? "Gantt"
                            : "Atlas"}
              </h2>
            </div>

            <div className="flex items-center gap-4">
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

      {/* Add New Team Dialog */}
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
              <div className="flex items-center gap-2 mt-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: teamColor }} />
                <span className="text-xs text-muted-foreground">Preview with selected color</span>
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
