import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Link as LinkIcon, Radio, PowerOff, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import HelpTooltip from "@/components/utils/HelpTooltip";

export default function StreamBlockForm({ session, block, segments, onClose, onSave }) {
  const [formData, setFormData] = useState({
    session_id: session?.id,
    block_type: 'link',
    title: '',
    presenter: '',
    description: '',
    stream_notes: '',
    anchor_segment_id: '',
    anchor_point: 'at_start',
    offset_min: 0,
    absolute_time: '',
    duration_min: '',
    color_code: 'default',
    stream_actions: [],
    // ...block
  });

  useEffect(() => {
    if (block) {
      setFormData({
        ...block,
        offset_min: block.offset_min ?? '',
        stream_actions: block.stream_actions || []
      });
    } else {
      setFormData(prev => ({
        ...prev,
        session_id: session?.id
      }));
    }
  }, [block, session]);

  // When linking to a segment, autofill title/duration if empty
  const handleAnchorChange = (segmentId) => {
    const segment = segments.find(s => s.id === segmentId);
    if (segment && formData.block_type === 'link') {
      setFormData(prev => ({
        ...prev,
        anchor_segment_id: segmentId,
        title: prev.title || segment.title, // Only autofill if empty
        presenter: prev.presenter || segment.presenter,
        duration_min: prev.duration_min || segment.duration_min
      }));
    } else {
      setFormData(prev => ({ ...prev, anchor_segment_id: segmentId }));
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      stream_actions: [
        ...prev.stream_actions,
        { label: '', timing: 'at_start', offset_min: 0, notes: '', is_required: false }
      ]
    }));
  };

  const updateAction = (index, field, value) => {
    const newActions = [...formData.stream_actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setFormData(prev => ({ ...prev, stream_actions: newActions }));
  };

  const removeAction = (index) => {
    const newActions = [...formData.stream_actions];
    newActions.splice(index, 1);
    setFormData(prev => ({ ...prev, stream_actions: newActions }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate required fields
    if (!formData.title) return;
    
    const submissionData = {
      ...formData,
      offset_min: parseInt(formData.offset_min) || 0,
      duration_min: formData.duration_min ? parseInt(formData.duration_min) : null,
    };
    
    onSave(submissionData);
  };

  const blockTypeColors = {
    link: "bg-blue-100 text-blue-800 border-blue-200",
    insert: "bg-green-100 text-green-800 border-green-200",
    replace: "bg-orange-100 text-orange-800 border-orange-200",
    offline: "bg-gray-100 text-gray-800 border-gray-200"
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="flex-1 overflow-y-scroll overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Block Type Selector */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Block Type</span>
          <HelpTooltip helpKey="stream.blockTypes" mode="modal" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {['link', 'insert', 'replace', 'offline'].map(type => (
            <div 
              key={type}
              onClick={() => updateField('block_type', type)}
              className={`
                cursor-pointer border-2 rounded-lg p-3 text-center transition-all
                ${formData.block_type === type ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-center mb-1">
                {type === 'link' && <LinkIcon className="w-5 h-5 text-blue-600" />}
                {type === 'insert' && <Plus className="w-5 h-5 text-green-600" />}
                {type === 'replace' && <Radio className="w-5 h-5 text-orange-600" />}
                {type === 'offline' && <PowerOff className="w-5 h-5 text-gray-600" />}
              </div>
              <div className="flex items-center justify-center gap-1">
                <div className="text-xs font-bold uppercase text-slate-700">{type}</div>
                <HelpTooltip helpKey={`stream.blockType.${type}`} side="bottom" />
              </div>
            </div>
          ))}
        </div>

        {/* Anchor Configuration */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3 h-3" /> Timing & Anchoring
            <HelpTooltip helpKey="stream.anchoring" mode="modal" />
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anchor Point</Label>
              <Select value={formData.anchor_point} onValueChange={(v) => updateField('anchor_point', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_start">At Start of Segment</SelectItem>
                  <SelectItem value="before_start">Before Segment Starts</SelectItem>
                  <SelectItem value="at_end">At End of Segment</SelectItem>
                  <SelectItem value="absolute">Fixed Time (Absolute)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.anchor_point === 'absolute' ? (
              <div className="space-y-2">
                <Label>Time (HH:MM)</Label>
                <Input 
                  type="time" 
                  value={formData.absolute_time} 
                  onChange={(e) => updateField('absolute_time', e.target.value)} 
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Anchor Segment</Label>
                <Select value={formData.anchor_segment_id} onValueChange={handleAnchorChange}>
                  <SelectTrigger><SelectValue placeholder="Select segment..." /></SelectTrigger>
                  <SelectContent>
                    {segments.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.order}. {s.title} ({s.start_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {formData.anchor_point !== 'absolute' && (
            <div className="flex items-center gap-4">
              <div className="w-24">
                <Label>Offset (min)</Label>
                <Input 
                  type="number" 
                  value={formData.offset_min} 
                  onChange={(e) => updateField('offset_min', e.target.value)} 
                />
              </div>
              <div className="text-xs text-slate-500 pt-6">
                Negative = Before anchor point • Positive = After anchor point
              </div>
            </div>
          )}
        </div>

        {/* Content Fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Block Title *</Label>
            <Input 
              value={formData.title} 
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. Pre-Show Interview" 
              className="text-lg font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Presenter / Host</Label>
              <Input 
                value={formData.presenter} 
                onChange={(e) => updateField('presenter', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  value={formData.duration_min} 
                  onChange={(e) => updateField('duration_min', e.target.value)}
                  placeholder={formData.block_type === 'link' ? "Inherit" : "Required"}
                />
                {formData.block_type === 'link' && !formData.duration_min && (
                  <span className="text-xs text-slate-400 italic whitespace-nowrap">Inherits segment duration</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stream Technical Notes</Label>
            <Textarea 
              value={formData.stream_notes} 
              onChange={(e) => updateField('stream_notes', e.target.value)}
              placeholder="Camera instructions, lower thirds details..."
              className="bg-slate-50"
            />
          </div>
        </div>

        <Separator />

        {/* Stream Actions (Cues) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Label className="text-base">Stream Actions (Cues)</Label>
              <HelpTooltip helpKey="stream.actions" />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addAction}>
              <Plus className="w-3 h-3 mr-1" /> Add Cue
            </Button>
          </div>
          
          {formData.stream_actions.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-sm">
              No specific cues for this block
            </div>
          ) : (
            <div className="space-y-2">
              {formData.stream_actions.map((action, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded border border-slate-100">
                  <div className="grid gap-2 flex-1">
                    <div className="flex gap-2">
                      <Input 
                        value={action.label} 
                        onChange={(e) => updateAction(idx, 'label', e.target.value)}
                        placeholder="Cue Label (e.g. Camera 1)"
                        className="h-8 text-sm"
                      />
                      {/* FIX #4 (2026-02-14): Added 'absolute' timing option — schema supports it */}
                      <Select value={action.timing} onValueChange={(v) => updateAction(idx, 'timing', v)}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before_start">Before Start</SelectItem>
                          <SelectItem value="after_start">After Start</SelectItem>
                          <SelectItem value="before_end">Before End</SelectItem>
                          <SelectItem value="absolute">Fixed Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        type="number"
                        value={action.offset_min ?? ''}
                        onChange={(e) => updateAction(idx, 'offset_min', e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="h-8 w-16 text-sm"
                        placeholder="Min"
                      />
                    </div>
                    <div className="flex gap-2">
                      {/* FIX #4 (2026-02-14): Show time input when 'absolute' timing is selected */}
                      {action.timing === 'absolute' && (
                        <Input
                          type="time"
                          value={action.absolute_time || ''}
                          onChange={(e) => updateAction(idx, 'absolute_time', e.target.value)}
                          className="h-7 text-xs bg-white w-28"
                          placeholder="HH:MM"
                        />
                      )}
                      <Input 
                        value={action.notes} 
                        onChange={(e) => updateAction(idx, 'notes', e.target.value)}
                        placeholder="Additional details..."
                        className="h-7 text-xs bg-white flex-1"
                      />
                    </div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeAction(idx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Stream Block</Button>
      </div>
    </form>
  );
}