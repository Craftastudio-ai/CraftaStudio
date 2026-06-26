"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Project {
  id: string;
  name: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  role: string;
  projects: Project[];
}

interface ProjectsSectionProps {
  activeProjectId?: string | null;
  onProjectSelect?: (projectId: string, projectName: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-(--primary-accent) border-t-transparent rounded-full animate-spin" />
  );
}

interface ProjectsSectionProps {
  activeProjectId?: string | null;
  onProjectSelect?: (projectId: string, projectName: string) => void;
}

export function ProjectsSection({ activeProjectId, onProjectSelect }: ProjectsSectionProps) {
  const { getToken } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New project form
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load workspace (${res.status})`);
      const data = await res.json();
      setTeams(data.teams ?? []);
      if (data.teams?.length > 0 && !selectedTeamId) {
        setSelectedTeamId(data.teams[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedTeamId]);

  useEffect(() => {
    const load = async () => {
      await fetchWorkspace();
    };
    void load();
  }, [fetchWorkspace]);

  const handleCreate = async () => {
    if (!newProjectName.trim() || !selectedTeamId) return;
    try {
      setCreateLoading(true);
      setCreateError(null);
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newProjectName.trim(), teamId: selectedTeamId }),
      });
      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? "Failed to create project");
      }
      setNewProjectName("");
      setCreating(false);
      await fetchWorkspace();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      setDeletingId(projectId);
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete project");
      setConfirmDeleteId(null);
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const allProjects = teams.flatMap((t) =>
    t.projects.map((p) => ({ ...p, teamName: t.name, teamRole: t.role }))
  );

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center gap-3 py-12 text-(--muted-foreground)">
        <Spinner />
        <span className="text-sm">Loading projects…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 text-sm text-red-400">
          {error}
          <button
            onClick={fetchWorkspace}
            className="ml-3 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-(--muted-foreground) tracking-wider uppercase">
            My Projects
          </h3>
          <button
            onClick={() => { setCreating(true); setCreateError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-(--primary-accent)/10 text-(--primary-accent) border border-(--primary-accent)/30 hover:bg-(--primary-accent)/20 transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="mb-4 border border-(--primary-accent)/40 rounded-xl bg-(--surface) p-4 space-y-3">
            <div className="text-sm font-medium text-(--foreground)">Create New Project</div>
            <input
              type="text"
              autoFocus
              placeholder="Project name…"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm bg-(--background) border border-(--border) text-(--foreground) placeholder:text-(--muted-foreground) focus:outline-none focus:border-(--primary-accent) transition-colors"
            />
            {teams.length > 1 && (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-(--background) border border-(--border) text-(--foreground) focus:outline-none focus:border-(--primary-accent) transition-colors"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {createError && (
              <div className="text-xs text-red-400">{createError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newProjectName.trim() || createLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-(--primary-accent) text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {createLoading ? <Spinner /> : <PlusIcon className="w-3.5 h-3.5" />}
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setNewProjectName(""); setCreateError(null); }}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-(--border) text-(--muted-foreground) hover:border-(--primary-accent)/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Projects list */}
        {allProjects.length === 0 ? (
          <div className="border border-dashed border-(--border) rounded-xl p-8 text-center">
            <FolderIcon className="w-8 h-8 mx-auto mb-2 text-(--muted-foreground) opacity-40" />
            <div className="text-sm text-(--muted-foreground)">No projects yet</div>
            <div className="text-xs text-(--muted-foreground) opacity-60 mt-1">
              Click &quot;New Project&quot; to get started
            </div>
          </div>
        ) : (
          <div className="border border-(--border) rounded-xl bg-(--surface) divide-y divide-(--border) overflow-hidden">
            {allProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onProjectSelect?.(project.id, project.name)}
                className={cn(
                  "w-full p-4 flex items-center gap-3 group transition-colors text-left",
                  project.id === activeProjectId
                    ? "bg-(--primary-accent)/10 border-l-4 border-(--primary-accent)"
                    : "hover:bg-(--primary-accent)/5"
                )}
              >
                <FolderIcon className="w-5 h-5 shrink-0 text-(--primary-accent) opacity-70" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-(--foreground) truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-(--muted-foreground) mt-0.5">
                    {project.teamName} · Created {formatDate(project.createdAt)}
                  </div>
                </div>

                {confirmDeleteId === project.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-(--muted-foreground)">Delete?</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(project.id);
                      }}
                      disabled={deletingId === project.id}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {deletingId === project.id ? <Spinner /> : "Yes"}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-(--border) text-(--muted-foreground) hover:border-(--primary-accent)/30 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteId(project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-(--muted-foreground) hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete project"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Workspace info */}
      {teams.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-(--muted-foreground) tracking-wider uppercase mb-4">
            Workspace
          </h3>
          <div className="border border-(--border) rounded-xl bg-(--surface) divide-y divide-(--border)">
            {teams.map((team) => (
              <div key={team.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-(--foreground)">{team.name}</div>
                  <div className="text-xs text-(--muted-foreground) mt-0.5">
                    {team.projects.length} project{team.projects.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-(--primary-accent)/10 text-(--primary-accent) border border-(--primary-accent)/20 capitalize">
                  {team.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}