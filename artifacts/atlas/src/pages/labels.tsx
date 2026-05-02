import React, { useState } from "react";
import { useListLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, getListLabelsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#84cc16", "#10b981", 
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", 
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
];

export default function Labels() {
  const { data: labels, isLoading } = useListLabels();
  const { role } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateLabel();
  const updateMutation = useUpdateLabel();
  const deleteMutation = useDeleteLabel();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", color: PRESET_COLORS[0] });

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ name: "", color: PRESET_COLORS[0] });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (label: any) => {
    setEditingId(label.id);
    setFormData({ name: label.name, color: label.color });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate(
        { labelId: editingId, data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLabelsQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "Label updated successfully" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLabelsQueryKey() });
            setIsDialogOpen(false);
            toast({ title: "Label created successfully" });
          }
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this label? It will be removed from all cards.")) {
      deleteMutation.mutate(
        { labelId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLabelsQueryKey() });
            toast({ title: "Label deleted" });
          }
        }
      );
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Labels</h1>
          <p className="text-muted-foreground">Manage taxonomy and categorization across all teams.</p>
        </div>
        {role === "admin" && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={handleOpenCreate} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Label
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Label" : "Create Label"}</DialogTitle>
                <DialogDescription>Define a tag that can be applied to any project card.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Label Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="e.g. Frontend, High Priority, Blocked" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-primary scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Input 
                      type="color" 
                      value={formData.color} 
                      onChange={e => setFormData({ ...formData, color: e.target.value })} 
                      className="w-12 h-10 p-1 cursor-pointer" 
                    />
                    <span className="text-sm font-mono text-muted-foreground">{formData.color}</span>
                  </div>
                </div>
                <div className="mt-4 p-4 border rounded-md bg-muted/30 flex items-center justify-center">
                  <span className="px-2.5 py-1 rounded text-sm font-medium text-white shadow-sm" style={{ backgroundColor: formData.color }}>
                    {formData.name || "Preview"}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="w-5 h-5" /> All Labels</CardTitle>
          <CardDescription>Global labels available to all teams.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : labels && labels.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Color</TableHead>
                  {role === "admin" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {labels.map(label => (
                  <TableRow key={label.id}>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm" style={{ backgroundColor: label.color }}>
                        {label.name}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{label.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{label.color}</span>
                    </TableCell>
                    {role === "admin" && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(label)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(label.id)}>
                          <Trash2 className="w-4 h-4 text-destructive hover:text-destructive/80" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No labels created yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
