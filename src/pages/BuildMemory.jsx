import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, CheckCircle, XCircle, AlertCircle, Ban } from "lucide-react";

export default function BuildMemory() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("decisions");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser?.role !== 'admin') {
        window.location.href = '/';
      }
      setUser(currentUser);
    };
    checkAuth();
  }, []);

  const { data: decisions = [] } = useQuery({
    queryKey: ['decisions'],
    queryFn: () => base44.entities.Decision.list('-created_date'),
    enabled: !!user
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ['attemptLogs'],
    queryFn: () => base44.entities.AttemptLog.list('-created_date'),
    enabled: !!user
  });

  const createDecisionMutation = useMutation({
    mutationFn: (data) => base44.entities.Decision.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['decisions']);
      setCreateDialogOpen(false);
    }
  });

  const createAttemptMutation = useMutation({
    mutationFn: (data) => base44.entities.AttemptLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['attemptLogs']);
      setCreateDialogOpen(false);
    }
  });

  const handleCreateDecision = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    createDecisionMutation.mutate({
      title: formData.get('title'),
      rationale: formData.get('rationale'),
      context: formData.get('context'),
      applies_to: formData.get('applies_to'),
      category: formData.get('category'),
      version: "1.0"
    });
  };

  const handleCreateAttempt = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    createAttemptMutation.mutate({
      approach: formData.get('approach'),
      outcome: formData.get('outcome'),
      details: formData.get('details'),
      category: formData.get('category'),
      attempted_at: new Date().toISOString()
    });
  };

  const filteredDecisions = decisions.filter(d => {
    const matchesSearch = !searchTerm || 
      d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.rationale?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredAttempts = attempts.filter(a => {
    const matchesSearch = !searchTerm || 
      a.approach?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const outcomeIcons = {
    success: <CheckCircle className="w-4 h-4 text-green-600" />,
    failed: <XCircle className="w-4 h-4 text-red-600" />,
    abandoned: <Ban className="w-4 h-4 text-gray-600" />,
    blocked: <AlertCircle className="w-4 h-4 text-yellow-600" />
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 uppercase">Build Memory</h1>
          <p className="text-gray-500 text-sm mt-1">Internal decision and attempt tracking (Admin only)</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-pdv-teal text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2 border-b">
                <Button 
                  variant={activeTab === 'decisions' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('decisions')}
                  className="rounded-none border-b-2"
                >
                  Decision
                </Button>
                <Button 
                  variant={activeTab === 'attempts' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('attempts')}
                  className="rounded-none border-b-2"
                >
                  Attempt Log
                </Button>
              </div>

              {activeTab === 'decisions' && (
                <form onSubmit={handleCreateDecision} className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input name="title" required placeholder="Short decision summary" />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select name="category" defaultValue="other">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="architecture">Architecture</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="ui_ux">UI/UX</SelectItem>
                        <SelectItem value="data_model">Data Model</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rationale *</Label>
                    <Textarea name="rationale" required placeholder="Why this decision was made" rows={3} />
                  </div>
                  <div>
                    <Label>Context</Label>
                    <Textarea name="context" placeholder="Technical or business context" rows={2} />
                  </div>
                  <div>
                    <Label>Applies To</Label>
                    <Input name="applies_to" placeholder="What part of the app this affects" />
                  </div>
                  <Button type="submit" className="w-full" disabled={createDecisionMutation.isPending}>
                    {createDecisionMutation.isPending ? 'Creating...' : 'Create Decision'}
                  </Button>
                </form>
              )}

              {activeTab === 'attempts' && (
                <form onSubmit={handleCreateAttempt} className="space-y-4">
                  <div>
                    <Label>Approach *</Label>
                    <Input name="approach" required placeholder="What was attempted" />
                  </div>
                  <div>
                    <Label>Outcome *</Label>
                    <Select name="outcome" defaultValue="failed">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select name="category" defaultValue="other">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf_generation">PDF Generation</SelectItem>
                        <SelectItem value="auth">Auth</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="ui">UI</SelectItem>
                        <SelectItem value="data">Data</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Details *</Label>
                    <Textarea name="details" required placeholder="Technical details, errors, or findings" rows={4} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createAttemptMutation.isPending}>
                    {createAttemptMutation.isPending ? 'Creating...' : 'Create Attempt Log'}
                  </Button>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="architecture">Architecture</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="ui_ux">UI/UX</SelectItem>
            <SelectItem value="data_model">Data Model</SelectItem>
            <SelectItem value="pdf_generation">PDF Generation</SelectItem>
            <SelectItem value="integration">Integration</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 border-b">
        <Button 
          variant={activeTab === 'decisions' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('decisions')}
        >
          Decisions ({decisions.length})
        </Button>
        <Button 
          variant={activeTab === 'attempts' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('attempts')}
        >
          Attempt Logs ({attempts.length})
        </Button>
      </div>

      {activeTab === 'decisions' && (
        <div className="space-y-4">
          {filteredDecisions.map((decision) => (
            <Card key={decision.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{decision.title}</CardTitle>
                  <Badge variant="outline">{decision.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Rationale:</p>
                  <p className="text-sm text-gray-600">{decision.rationale}</p>
                </div>
                {decision.context && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Context:</p>
                    <p className="text-sm text-gray-600">{decision.context}</p>
                  </div>
                )}
                {decision.applies_to && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Applies To:</p>
                    <p className="text-sm text-gray-600">{decision.applies_to}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Created: {new Date(decision.created_date).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
          {filteredDecisions.length === 0 && (
            <Card className="p-8 text-center text-gray-500">
              No decisions found
            </Card>
          )}
        </div>
      )}

      {activeTab === 'attempts' && (
        <div className="space-y-4">
          {filteredAttempts.map((attempt) => (
            <Card key={attempt.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {outcomeIcons[attempt.outcome]}
                    <CardTitle className="text-lg">{attempt.approach}</CardTitle>
                  </div>
                  <Badge variant="outline">{attempt.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Outcome: {attempt.outcome}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Details:</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{attempt.details}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Created: {new Date(attempt.created_date).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
          {filteredAttempts.length === 0 && (
            <Card className="p-8 text-center text-gray-500">
              No attempt logs found
            </Card>
          )}
        </div>
      )}
    </div>
  );
}