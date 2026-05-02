import React from "react";
import { 
  useListTeams, 
  useCreateTeam, 
  useUpdateTeam, 
  useDeleteTeam,
  useListMembers,
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
  getListTeamsQueryKey,
  getListMembersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Settings2, Users, Layers, ShieldAlert, Trash2, Edit2, Plus } from "lucide-react";

export default function Settings() {
  const { role } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: teams, isLoading: loadingTeams } = useListTeams();
  const { data: members, isLoading: loadingMembers } = useListMembers();

  // Team Mutations
  const createTeamMutation = useCreateTeam();
  const updateTeamMutation = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();

  // Member Mutations
  const createMemberMutation = useCreateMember();
  const updateMemberMutation = useUpdateMember();
  const deleteMemberMutation = useDeleteMember();

  // State
  const [isTeamDialogOpen, setIsTeamDialogOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<any>(null);
  const [teamForm, setTeamForm] = React.useState({ name: "", slug: "", description: "", color: "#3b82f6" });

  const [isMemberDialogOpen, setIsMemberDialogOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<any>(null);
  const [memberForm, setMemberForm] = React.useState({ 
    name: "", email: "", teamId: "", role: "member" as any, avatarColor: "#94a3b8" 
  });

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-60px)] space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-50" />
        <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can access workspace settings.</p>
      </div>
    );
  }

  const handleOpenTeamCreate = () => {
    setEditingTeam(null);
    setTeamForm({ name: "", slug: "", description: "", color: "#3b82f6" });
    setIsTeamDialogOpen(true);
  };

  const handleOpenTeamEdit = (team: any) => {
    setEditingTeam(team.id);
    setTeamForm({ name: team.name, slug: team.slug, description: team.description || "", color: team.color });
    setIsTeamDialogOpen(true);
  };

  const submitTeam = () => {
    if (editingTeam) {
      updateTeamMutation.mutate({
        teamId: editingTeam,
        data: { ...teamForm }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setIsTeamDialogOpen(false);
          toast({ title: "Team updated" });
        }
      });
    } else {
      createTeamMutation.mutate({
        data: { ...teamForm }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setIsTeamDialogOpen(false);
          toast({ title: "Team created" });
        }
      });
    }
  };

  const handleOpenMemberCreate = () => {
    setEditingMember(null);
    setMemberForm({ name: "", email: "", teamId: teams?.[0]?.id.toString() || "", role: "member", avatarColor: "#94a3b8" });
    setIsMemberDialogOpen(true);
  };

  const handleOpenMemberEdit = (member: any) => {
    setEditingMember(member.id);
    setMemberForm({ 
      name: member.name, 
      email: member.email, 
      teamId: member.teamId.toString(), 
      role: member.role,
      avatarColor: member.avatarColor 
    });
    setIsMemberDialogOpen(true);
  };

  const submitMember = () => {
    if (editingMember) {
      updateMemberMutation.mutate({
        memberId: editingMember,
        data: { ...memberForm, teamId: parseInt(memberForm.teamId) }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setIsMemberDialogOpen(false);
          toast({ title: "Member updated" });
        }
      });
    } else {
      createMemberMutation.mutate({
        data: { ...memberForm, teamId: parseInt(memberForm.teamId) }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setIsMemberDialogOpen(false);
          toast({ title: "Member added" });
        }
      });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground">Manage your organization's teams, members, and preferences.</p>
      </div>

      <Tabs defaultValue="teams" className="space-y-6">
        <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-grid">
          <TabsTrigger value="teams" className="flex items-center gap-2"><Layers className="w-4 h-4"/> Teams</TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2"><Users className="w-4 h-4"/> Members</TabsTrigger>
        </TabsList>

        {/* TEAMS TAB */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Data Science Teams</h3>
            <Button onClick={handleOpenTeamCreate}><Plus className="w-4 h-4 mr-2"/> Add Team</Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams?.map(team => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{team.slug}</TableCell>
                      <TableCell className="text-muted-foreground">{team.description}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenTeamEdit(team)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Delete team? This removes all associated members and cards.")) {
                            deleteTeamMutation.mutate({ teamId: team.id }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })
                            });
                          }
                        }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Workspace Members</h3>
            <Button onClick={handleOpenMemberCreate} disabled={!teams?.length}><Plus className="w-4 h-4 mr-2"/> Add Member</Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: member.avatarColor }}>
                          {member.name.charAt(0)}
                        </div>
                        {member.name}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {teams?.find(t => t.id === member.teamId)?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenMemberEdit(member)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Remove member?")) {
                            deleteMemberMutation.mutate({ memberId: member.id }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
                            });
                          }
                        }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Team Dialog */}
      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Edit Team" : "Create Team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value, slug: !editingTeam ? e.target.value.toLowerCase().replace(/\s+/g, '-') : teamForm.slug})} />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <Input value={teamForm.slug} onChange={e => setTeamForm({...teamForm, slug: e.target.value})} disabled={!!editingTeam} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={teamForm.description} onChange={e => setTeamForm({...teamForm, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input type="color" value={teamForm.color} onChange={e => setTeamForm({...teamForm, color: e.target.value})} className="w-12 h-10 p-1" />
                <span className="font-mono text-sm">{teamForm.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitTeam} disabled={!teamForm.name || !teamForm.slug}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Dialog */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={memberForm.name} onChange={e => setMemberForm({...memberForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={memberForm.teamId} onValueChange={v => setMemberForm({...memberForm, teamId: v})}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={memberForm.role} onValueChange={v => setMemberForm({...memberForm, role: v as any})}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avatar Color</Label>
              <Input type="color" value={memberForm.avatarColor} onChange={e => setMemberForm({...memberForm, avatarColor: e.target.value})} className="w-12 h-10 p-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitMember} disabled={!memberForm.name || !memberForm.teamId}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
