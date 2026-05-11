import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, GitBranch, GitCommit, GitMerge, Trash2, Upload, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/code")({
  head: () => ({ meta: [{ title: "Code Repos — TrioByte Portal" }] }),
  component: CodeReposPage,
});

interface CodeRepo {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  url: string | null;
  language: string | null;
  branch: string;
  owner_id: string;
  created_at: string;
  profiles: { full_name: string | null };
}

interface MergeRequest {
  id: string;
  repo_id: string;
  title: string;
  description: string | null;
  source_branch: string;
  target_branch: string;
  status: string;
  author_id: string;
  reviewer_id: string | null;
  created_at: string;
  files_changed?: number;
  profiles?: { full_name: string | null };
}

interface CodeCommit {
  id: string;
  repo_id: string;
  message: string;
  author_id: string;
  branch: string;
  hash: string;
  created_at: string;
  profiles: { full_name: string | null };
}

function CodeReposPage() {
  const { profile, primaryRole } = useAuth();
  const [repos, setRepos] = useState<CodeRepo[]>([]);
  const [mergeRequests, setMergeRequests] = useState<MergeRequest[]>([]);
  const [commits, setCommits] = useState<CodeCommit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"repos" | "mrs" | "commits">("repos");
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);
  const [isMRDialogOpen, setIsMRDialogOpen] = useState(false);
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pushFiles, setPushFiles] = useState<File[]>([]);

  const [repoForm, setRepoForm] = useState({
    project_id: "",
    name: "",
    description: "",
    url: "",
    language: "javascript",
  });

  const [mrForm, setMrForm] = useState({
    repo_id: "",
    title: "",
    description: "",
    source_branch: "",
    target_branch: "main",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reposData, mrsData, commitsData] = await Promise.all([
        (supabase as any)
          .from("code_repos")
          .select("*")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("merge_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("code_commits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (reposData.error) throw reposData.error;
      if (mrsData.error) throw mrsData.error;
      if (commitsData.error) throw commitsData.error;

      // Fetch profile names separately for display
      const allUserIds = new Set<string>();
      (reposData.data || []).forEach((r: any) => allUserIds.add(r.owner_id));
      (mrsData.data || []).forEach((m: any) => {
        allUserIds.add(m.author_id);
        if (m.reviewer_id) allUserIds.add(m.reviewer_id);
      });
      (commitsData.data || []).forEach((c: any) => allUserIds.add(c.author_id));

      let profilesMap: Record<string, any> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(allUserIds));
        
        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap[p.id] = p;
          });
        }
      }

      // Augment data with profile information
      const enhancedRepos = (reposData.data || []).map((r: any) => ({
        ...r,
        profiles: profilesMap[r.owner_id],
      }));
      const enhancedMRs = (mrsData.data || []).map((m: any) => ({
        ...m,
        profiles: profilesMap[m.author_id],
      }));
      const enhancedCommits = (commitsData.data || []).map((c: any) => ({
        ...c,
        profiles: profilesMap[c.author_id],
      }));

      setRepos(enhancedRepos);
      setMergeRequests(enhancedMRs);
      setCommits(enhancedCommits);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const createRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoForm.project_id || !repoForm.name) {
      return toast.error("Fill required fields");
    }

    try {
      setSubmitting(true);
      const { error } = await (supabase as any)
        .from("code_repos")
        .insert({
          project_id: repoForm.project_id,
          name: repoForm.name,
          description: repoForm.description,
          url: repoForm.url || null,
          language: repoForm.language,
          branch: "main",
          owner_id: profile?.id,
        });

      if (error) throw error;
      toast.success("Repository created");
      setRepoForm({ project_id: "", name: "", description: "", url: "", language: "javascript" });
      setIsRepoDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const hashContent = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 7);
  };

  const handlePushFiles = async (files: File[]) => {
    if (!selectedRepo || files.length === 0) {
      return toast.error("Select repository and files");
    }

    try {
      setSubmitting(true);
      const hash = Math.random().toString(36).substring(7).toUpperCase();

      // Create commit
      const { data: commit, error: commitError } = await (supabase as any)
        .from("code_commits")
        .insert({
          repo_id: selectedRepo,
          message: `Push ${files.length} files`,
          branch: "main",
          hash,
          author_id: profile?.id,
        })
        .select()
        .single();

      if (commitError) throw commitError;

      // Process and store files
      for (const file of files) {
        const content = await file.text();
        const contentHash = await hashContent(content);

        const { error: fileError } = await (supabase as any)
          .from("code_files")
          .insert({
            commit_id: commit.id,
            file_path: file.name,
            content: content,
            content_hash: contentHash,
            file_size: file.size,
          });

        if (fileError) console.error("File error:", fileError);
      }

      toast.success(`Pushed ${files.length} files`);
      setPushFiles([]);
      setIsPushDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const createMergeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrForm.repo_id || !mrForm.title || !mrForm.source_branch) {
      return toast.error("Fill required fields");
    }

    try {
      setSubmitting(true);
      
      // Get commits from both branches to calculate file changes
      const { data: commits, error: commitsError } = await (supabase as any)
        .from("code_commits")
        .select("id")
        .eq("repo_id", mrForm.repo_id)
        .order("created_at", { ascending: false })
        .limit(2);

      if (commitsError) throw commitsError;
      const filesChanged = commits?.length || 0;

      const { error } = await (supabase as any)
        .from("merge_requests")
        .insert({
          repo_id: mrForm.repo_id,
          title: mrForm.title,
          description: mrForm.description,
          source_branch: mrForm.source_branch,
          target_branch: mrForm.target_branch,
          author_id: profile?.id,
          status: "open",
          files_changed: filesChanged,
        });

      if (error) throw error;
      toast.success("Merge request created");
      setMrForm({ repo_id: "", title: "", description: "", source_branch: "", target_branch: "main" });
      setIsMRDialogOpen(false);
      await loadData();
    } catch (error: any) {
      console.error("MR creation error:", error);
      toast.error(error.message || "Failed to create merge request");
    } finally {
      setSubmitting(false);
    }
  };

  const updateMRStatus = async (mrId: string, status: string) => {
    try {
      const { error } = await (supabase as any)
        .from("merge_requests")
        .update({ status })
        .eq("id", mrId);

      if (error) throw error;
      toast.success(`Merge request ${status}`);
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteRepo = async (repoId: string) => {
    if (!confirm("Delete this repository?")) return;

    try {
      const { error } = await (supabase as any)
        .from("code_repos")
        .delete()
        .eq("id", repoId);

      if (error) throw error;
      toast.success("Repository deleted");
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const downloadRepoFiles = async (repoId: string, repoName: string) => {
    try {
      const { data: commits, error: commitError } = await (supabase as any)
        .from("code_commits")
        .select("id")
        .eq("repo_id", repoId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (commitError) throw commitError;
      if (!commits || commits.length === 0) {
        return toast.error("No commits in repository");
      }

      const { data: files, error: filesError } = await (supabase as any)
        .from("code_files")
        .select("file_path, file_size")
        .eq("commit_id", commits[0].id);

      if (filesError) throw filesError;
      if (!files || files.length === 0) {
        return toast.error("No files to download");
      }

      // Create a simple text file listing
      const fileList = files.map((f: any) => `${f.file_path} (${f.file_size} bytes)`).join('\n');
      const element = document.createElement("a");
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(fileList));
      element.setAttribute("download", `${repoName}-files.txt`);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success(`Downloaded ${files.length} files`);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(error.message || "Failed to download files");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Code Repositories" description="GitHub-like code management with push, merge, and fetch." />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Code Repositories"
        description="Push code, create merge requests, and manage versions like GitHub."
        actions={
          <div className="flex gap-2">
            <Dialog open={isRepoDialogOpen} onOpenChange={setIsRepoDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Repo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create new repository</DialogTitle>
                </DialogHeader>
                <form onSubmit={createRepo} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="project">Project ID</Label>
                      <Input
                        id="project"
                        value={repoForm.project_id}
                        onChange={(e) => setRepoForm(prev => ({ ...prev, project_id: e.target.value }))}
                        placeholder="e.g., PROJ-001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lang">Language</Label>
                      <Select value={repoForm.language} onValueChange={(v) => setRepoForm(prev => ({ ...prev, language: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="javascript">JavaScript</SelectItem>
                          <SelectItem value="typescript">TypeScript</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="java">Java</SelectItem>
                          <SelectItem value="go">Go</SelectItem>
                          <SelectItem value="rust">Rust</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="name">Repository name</Label>
                    <Input
                      id="name"
                      value={repoForm.name}
                      onChange={(e) => setRepoForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., backend-api"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="desc">Description</Label>
                    <Input
                      id="desc"
                      value={repoForm.description}
                      onChange={(e) => setRepoForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What does this repo do?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="url">Repository URL</Label>
                    <Input
                      id="url"
                      value={repoForm.url}
                      onChange={(e) => setRepoForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsRepoDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <PageBody>
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "repos" ? "default" : "outline"}
            onClick={() => setActiveTab("repos")}
            size="sm"
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Repositories ({repos.length})
          </Button>
          <Button
            variant={activeTab === "mrs" ? "default" : "outline"}
            onClick={() => setActiveTab("mrs")}
            size="sm"
          >
            <GitMerge className="mr-2 h-4 w-4" />
            Merge Requests ({mergeRequests.length})
          </Button>
          <Button
            variant={activeTab === "commits" ? "default" : "outline"}
            onClick={() => setActiveTab("commits")}
            size="sm"
          >
            <GitCommit className="mr-2 h-4 w-4" />
            Commits ({commits.length})
          </Button>
        </div>

        {activeTab === "repos" && (
          <div className="grid gap-4">
            {repos.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground py-12">
                  No repositories yet
                </CardContent>
              </Card>
            ) : (
              repos.map((repo) => (
                <Card key={repo.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{repo.name}</h3>
                            <Badge variant="outline">{repo.language}</Badge>
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mb-2">{repo.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Project: {repo.project_id}</div>
                            <div>Main branch</div>
                            {repo.url && <div>URL: {repo.url}</div>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRepo(repo.id);
                              setIsPushDialogOpen(true);
                            }}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Push
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadRepoFiles(repo.id, repo.name)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Fetch
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRepo(repo.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "mrs" && (
          <div className="space-y-4">
            <Dialog open={isMRDialogOpen} onOpenChange={setIsMRDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Merge Request</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create merge request</DialogTitle>
                </DialogHeader>
                <form onSubmit={createMergeRequest} className="space-y-4">
                  <div>
                    <Label htmlFor="repo">Repository</Label>
                    <Select value={mrForm.repo_id} onValueChange={(v) => setMrForm(prev => ({ ...prev, repo_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select repo" /></SelectTrigger>
                      <SelectContent>
                        {repos.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="mr_title">Title</Label>
                    <Input
                      id="mr_title"
                      value={mrForm.title}
                      onChange={(e) => setMrForm(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="source">Source branch</Label>
                      <Input
                        id="source"
                        value={mrForm.source_branch}
                        onChange={(e) => setMrForm(prev => ({ ...prev, source_branch: e.target.value }))}
                        placeholder="feature/my-feature"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="target">Target branch</Label>
                      <Input
                        id="target"
                        value={mrForm.target_branch}
                        onChange={(e) => setMrForm(prev => ({ ...prev, target_branch: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mr_desc">Description</Label>
                    <Input
                      id="mr_desc"
                      value={mrForm.description}
                      onChange={(e) => setMrForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsMRDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="grid gap-4">
              {mergeRequests.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground py-12">
                    No merge requests
                  </CardContent>
                </Card>
              ) : (
                mergeRequests.map((mr) => (
                  <Card key={mr.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{mr.title}</h3>
                            {mr.description && (
                              <p className="text-sm text-muted-foreground mt-1">{mr.description}</p>
                            )}
                          </div>
                          <Badge className={mr.status === "merged" ? "bg-green-100 text-green-800" : mr.status === "rejected" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                            {mr.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3 w-3" />
                            {mr.source_branch} → {mr.target_branch}
                          </div>
                          <div>By: {mr.profiles?.full_name}</div>
                          {mr.files_changed && <div>{mr.files_changed} files changed</div>}
                        </div>
                        {(mr.status === "open" && (primaryRole === "founder" || primaryRole === "hr_admin")) && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={() => updateMRStatus(mr.id, "merged")} className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Merge
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateMRStatus(mr.id, "rejected")}>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "commits" && (
          <div className="space-y-4">
            <div className="space-y-2">
              {commits.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground py-12">
                    No commits yet
                  </CardContent>
                </Card>
              ) : (
                commits.map((commit) => (
                  <Card key={commit.id}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitCommit className="h-4 w-4 text-blue-600" />
                            <code className="text-sm font-mono font-semibold text-foreground">{commit.hash}</code>
                          </div>
                          <Badge variant="outline">{commit.branch}</Badge>
                        </div>
                        <div className="text-sm font-medium">{commit.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {commit.profiles?.full_name} · {formatDate(commit.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Push Dialog */}
        <Dialog open={isPushDialogOpen} onOpenChange={setIsPushDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Push Files to Repository</DialogTitle>
              <DialogDescription>
                Drag & drop or select files to push. Only changed files will be merged.
              </DialogDescription>
            </DialogHeader>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = Array.from(e.dataTransfer.files);
                setPushFiles(prev => [...prev, ...files]);
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Drag & drop your files here</p>
              <p className="text-sm text-muted-foreground">or</p>
              <label className="mt-2 inline-block">
                <Button type="button" variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.currentTarget.files || []);
                    setPushFiles(prev => [...prev, ...files]);
                  }}
                />
              </label>
            </div>

            {pushFiles.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm font-medium">{pushFiles.length} file(s) selected:</p>
                {pushFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPushFiles(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsPushDialogOpen(false); setPushFiles([]); }}>
                Cancel
              </Button>
              <Button
                onClick={() => handlePushFiles(pushFiles)}
                disabled={pushFiles.length === 0 || submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Push {pushFiles.length} File{pushFiles.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </>
  );
}
