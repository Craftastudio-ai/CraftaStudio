"use client";

import { X, User, Bot, FolderKanban, Bell, Cpu, Palette, LayoutPanelLeft, FileCode2, Puzzle, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

import { AccountSection } from "./sections/Account";
import { AgentSection } from "./sections/Agent";
import { ProjectsSection } from "./sections/Projects";
import { NotificationsSection } from "./sections/Notifications";
import { ModelsSection } from "./sections/Models";
import { CustomizationsSection } from "./sections/Customizations";
import { TabSection } from "./sections/Tab";
import { EditorSection } from "./sections/Editor";
import { MCPPluginsSection } from "./sections/MCPPlugins";
import { AuditLogSection } from "./sections/AuditLog";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId?: string | null;
  onProjectSelect?: (projectId: string, projectName: string) => void;
}

const STORAGE_KEY = "craftastudio-settings-tab";

type TabId = "account" | "agent" | "projects" | "notifications" | "models" | "customizations" | "tab" | "editor" | "mcp" | "audit";

interface SidebarItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    title: "",
    items: [
      { id: "account", label: "Account", icon: User },
    ],
  },
  {
    title: "GLOBAL",
    items: [
      { id: "agent", label: "Agent", icon: Bot },
      { id: "projects", label: "Projects", icon: FolderKanban },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "models", label: "Models", icon: Cpu },
      { id: "customizations", label: "Customizations", icon: Palette },
      { id: "tab", label: "Tab", icon: LayoutPanelLeft },
      { id: "editor", label: "Editor", icon: FileCode2 },
      { id: "mcp", label: "MCP Plugins", icon: Puzzle },
      { id: "audit", label: "Audit Log (Credits)", icon: ScrollText },
    ],
  },
];

const allItems = sidebarGroups.flatMap((g) => g.items);

function getLabel(id: TabId): string {
  return allItems.find((item) => item.id === id)?.label ?? id;
}

function renderSection(id: TabId, activeProjectId?: string | null, onProjectSelect?: (projectId: string, projectName: string) => void) {
  switch (id) {
    case "account": return <AccountSection />;
    case "agent": return <AgentSection />;
    case "projects": return <ProjectsSection activeProjectId={activeProjectId} onProjectSelect={onProjectSelect} />;
    case "notifications": return <NotificationsSection />;
    case "models": return <ModelsSection />;
    case "customizations": return <CustomizationsSection />;
    case "tab": return <TabSection />;
    case "editor": return <EditorSection />;
    case "mcp": return <MCPPluginsSection />;
    case "audit": return <AuditLogSection />;
    default: return null;
  }
}

export function SettingsPanel({ isOpen, onClose, activeProjectId, onProjectSelect }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("account");

  // Load persisted tab from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TabId | null;
      if (saved && allItems.some((item) => item.id === saved)) {
        setActiveTab(saved);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Update tab state if localStorage changes from another component (like MainSidebar)
  useEffect(() => {
    if (!isOpen) return; // Only trigger check when opening
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TabId | null;
      if (saved && saved !== activeTab && allItems.some((item) => item.id === saved)) {
        setActiveTab(saved);
      }
    } catch {
    }
  }, [isOpen]);

  // Persist tab to localStorage
  const switchTab = useCallback((id: TabId) => {
    setActiveTab(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-5xl h-[80vh] bg-(--surface) border border-(--border) rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-(--border) flex items-center justify-center relative bg-(--surface)">
          <h2 className="text-sm font-medium text-(--muted-foreground)">
            Settings — {getLabel(activeTab)}
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 p-2 hover:bg-(--foreground)/5 rounded-lg transition-colors text-(--muted-foreground) hover:text-(--foreground)"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-60 bg-(--background) border-r border-(--border) p-3 flex flex-col gap-6 overflow-y-auto">
            {sidebarGroups.map((group, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                {group.title && (
                  <span className="text-[10px] font-bold text-(--muted-foreground) tracking-wider px-3 mb-2 uppercase opacity-60">
                    {group.title}
                  </span>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => switchTab(item.id)}
                      className={cn(
                        "flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-(--primary-accent)/10 text-(--primary-accent) font-medium"
                          : "text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--foreground)/5"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", isActive ? "text-(--primary-accent)" : "")} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-(--surface) p-8 overflow-y-auto">
            <div key={activeTab} className="animate-in fade-in duration-200">
              {renderSection(activeTab, activeProjectId, onProjectSelect)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
