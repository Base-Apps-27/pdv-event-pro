import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import HelpTooltip from "@/components/utils/HelpTooltip";
import StreamBlockItem from "./StreamBlockItem";
import StreamBlockForm from "./StreamBlockForm";
import AIStreamHelper from "./AIStreamHelper";
import { toast } from "sonner";
// Universal log (2026-02-19): StreamBlock mutations now logged for full audit trail
import { logCreate, logUpdate, logDelete } from "@/components/utils/editActionLogger";

export default function StreamBlockList({ sessionId, session, segments, sessionDate, user, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const queryClient = useQueryClient();

  // Fetch StreamBlocks for this session
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['streamBlocks', sessionId],
    queryFn: () => base44.entities.StreamBlock.filter({ session_id: sessionId }, 'order'),
    enabled: !!sessionId
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StreamBlock.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['streamBlocks', sessionId]);
      setShowForm(false);
      setEditingBlock(null);
      toast.success("Stream block created");
      logCreate('StreamBlock', result, sessionId, currentUser || user);
    },
    onError: () => toast.error("Failed to create block")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, prev }) => base44.entities.StreamBlock.update(id, data).then(r => ({ result: r, prev })),
    onSuccess: ({ result, prev }) => {
      queryClient.invalidateQueries(['streamBlocks', sessionId]);
      setShowForm(false);
      setEditingBlock(null);
      toast.success("Stream block updated");
      if (prev) logUpdate('StreamBlock', prev.id, prev, result, sessionId, currentUser || user);
    },
    onError: () => toast.error("Failed to update block")
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.StreamBlock.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['streamBlocks', sessionId]);
      toast.success("Block deleted");
      if (variables.block) logDelete('StreamBlock', variables.block, sessionId, currentUser || user);
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ blockId, newOrder }) => {
      return base44.entities.StreamBlock.update(blockId, { order: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['streamBlocks', sessionId]);
    }
  });

  const handleMoveBlock = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);

    // Optimistic update locally? No, let's just trigger updates
    await Promise.all(
      newBlocks.map((b, i) => reorderMutation.mutateAsync({ blockId: b.id, newOrder: i + 1 }))
    );
  };

  const handleSave = (data) => {
    if (editingBlock) {
      updateMutation.mutate({ id: editingBlock.id, data, prev: editingBlock });
    } else {
      createMutation.mutate({
        ...data,
        session_id: sessionId,
        order: blocks.length + 1
      });
    }
  };

  const openNew = () => {
    setEditingBlock(null);
    setShowForm(true);
  };

  const openEdit = (block) => {
    setEditingBlock(block);
    setShowForm(true);
  };

  const handleDelete = (block) => {
    if (confirm(`Delete "${block.title}"?`)) {
      deleteMutation.mutate({ id: block.id, block });
    }
  };

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Header / Actions — stacked on mobile to prevent overflow */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
        <div className="flex items-center gap-2">
          <div className="bg-white p-1.5 rounded-md border shadow-sm">
            <span className="font-bold text-lg text-blue-600 font-mono">{blocks.length}</span>
          </div>
          <div className="text-sm font-medium text-slate-600 flex items-center gap-1">
            Stream Blocks
            <HelpTooltip helpKey="stream.overview" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAIHelper(true)} size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 flex-1">
            <Sparkles className="w-4 h-4 mr-1" /> IA Stream
          </Button>
          <Button onClick={openNew} size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1">
            <Plus className="w-4 h-4 mr-1" /> Add Block
          </Button>
        </div>
      </div>

      {/* Block List */}
      <div className="space-y-2">
        {blocks.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-slate-500 mb-2">No stream blocks yet</p>
            <Button variant="outline" size="sm" onClick={openNew}>Create First Block</Button>
          </div>
        ) : (
          blocks.map((block, index) => (
            <StreamBlockItem
              key={block.id}
              block={block}
              index={index}
              total={blocks.length}
              segments={segments}
              sessionDate={sessionDate}
              onEdit={openEdit}
              onDelete={handleDelete}
              onMove={handleMoveBlock}
            />
          ))
        )}
      </div>

      {/* AI Stream Helper */}
      <AIStreamHelper
        isOpen={showAIHelper}
        onClose={() => setShowAIHelper(false)}
        session={session || { id: sessionId }}
        segments={segments || []}
        onBlocksCreated={() => queryClient.invalidateQueries(['streamBlocks', sessionId])}
      />

      {/* Editor Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-xl font-bold uppercase tracking-wide">
              {editingBlock ? 'Edit Stream Block' : 'New Stream Block'}
            </DialogTitle>
          </DialogHeader>
          <StreamBlockForm
            session={{ id: sessionId }}
            block={editingBlock}
            segments={segments}
            onClose={() => setShowForm(false)}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}