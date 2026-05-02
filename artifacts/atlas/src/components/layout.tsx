import React from "react";
import { Link, useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import { useListTeams } from "@workspace/api-client-react";
import { LayoutDashboard, Kanban, Tags, Settings, Activity, UserCircle } from "lucide-react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent, 
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { role, setRole } = useAppStore();
  const { data: teams } = useListTeams();

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
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider">Overview</SidebarGroupLabel>
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
            
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-xs tracking-wider mt-4">Teams</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams?.map(team => (
                    <SidebarMenuItem key={team.id}>
                      <SidebarMenuButton asChild isActive={location === `/board/${team.slug}`}>
                        <Link href={`/board/${team.slug}`} className="text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                          <span className="truncate">{team.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border mx-2" />
              <h2 className="text-sm font-medium text-muted-foreground capitalize">
                {location.split("/")[1] || "Dashboard"}
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
    </SidebarProvider>
  );
}
