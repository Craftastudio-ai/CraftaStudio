"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level: number;
  dependencies: string[];
  subtasks: Subtask[];
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Research Project Requirements",
    description:
      "Gather all necessary information about project scope and requirements",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "1.1",
        title: "Interview stakeholders",
        description:
          "Conduct interviews with key stakeholders to understand needs",
        status: "completed",
        priority: "high",
        tools: ["communication-agent", "meeting-scheduler"],
      },
    ],
  },
];

export default function Plan({ externalTasks }: { externalTasks?: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(externalTasks || initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<{ [key: string]: boolean }>({});
  
  useEffect(() => {
    if (externalTasks) {
      setTasks(externalTasks);
      // Auto-expand currently running tasks
      const runningTasks = externalTasks.filter(t => t.status === "in-progress" || t.status === "running").map(t => t.id);
      if (runningTasks.length > 0) {
        setExpandedTasks(prev => Array.from(new Set([...prev, ...runningTasks])));
      }
    }
  }, [externalTasks]);

  const prefersReducedMotion = 
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: { 
      opacity: 1, y: 0,
      transition: { 
        type: (prefersReducedMotion ? "tween" : "spring") as any, 
        stiffness: 500, damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -5, transition: { duration: 0.15 } }
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { 
      height: "auto", opacity: 1, overflow: "visible",
      transition: { 
        duration: 0.25, staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren", ease: [0.2, 0.65, 0.3, 0.9] as any
      }
    },
    exit: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] as any } }
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: { 
      opacity: 1, x: 0,
      transition: { 
        type: (prefersReducedMotion ? "tween" : "spring") as any, 
        stiffness: 500, damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined
      }
    },
    exit: { opacity: 0, x: prefersReducedMotion ? 0 : -10, transition: { duration: 0.15 } }
  };

  const statusBadgeVariants = {
    initial: { scale: 1 },
    animate: { 
      scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
      transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] as any }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": case "done": return "text-green-500";
      case "in-progress": case "running": return "text-purple-500";
      case "need-help": case "awaiting_confirm": return "text-yellow-500";
      case "failed": return "text-red-500";
      default: return "text-zinc-500";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "completed": case "done": return "bg-green-500/10 text-green-400 border border-green-500/20";
      case "in-progress": case "running": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "need-help": case "awaiting_confirm": return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
      case "failed": return "bg-red-500/10 text-red-400 border border-red-500/20";
      default: return "bg-zinc-800 text-zinc-400 border border-zinc-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": case "done": return <CheckCircle2 className={`h-4.5 w-4.5 ${getStatusColor(status)}`} />;
      case "in-progress": case "running": return <CircleDotDashed className={`h-4.5 w-4.5 ${getStatusColor(status)} animate-spin-slow`} />;
      case "need-help": case "awaiting_confirm": return <CircleAlert className={`h-4.5 w-4.5 ${getStatusColor(status)}`} />;
      case "failed": return <CircleX className={`h-4.5 w-4.5 ${getStatusColor(status)}`} />;
      default: return <Circle className="text-zinc-600 h-4.5 w-4.5" />;
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").toUpperCase();
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm italic">
        Awaiting architect analysis...
      </div>
    );
  }

  return (
    <div className="bg-transparent text-white h-full overflow-auto p-1 scrollbar-none">
      <motion.div 
        className="bg-transparent rounded-lg overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] } }}
      >
        <LayoutGroup>
          <div className="p-2 overflow-hidden">
            <ul className="space-y-1 overflow-hidden">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed" || task.status === "done";

                return (
                  <motion.li
                    key={task.id}
                    className={` ${index !== 0 ? "mt-1 pt-2" : ""} `}
                    initial="hidden" animate="visible" variants={taskVariants}
                  >
                    <motion.div 
                      className="group flex items-center px-3 py-1.5 rounded-md"
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", transition: { duration: 0.2 } }}
                    >
                      <motion.div className="mr-3 flex-shrink-0">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                            transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                          >
                            {getStatusIcon(task.status)}
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>

                      <motion.div
                        className="flex min-w-0 flex-grow cursor-pointer items-center justify-between"
                        onClick={() => toggleTaskExpansion(task.id)}
                      >
                        <div className="mr-2 flex-1 truncate">
                          <span className={`text-sm font-medium ${isCompleted ? "text-zinc-500" : "text-zinc-200"}`}>
                            {task.title}
                          </span>
                        </div>

                        <div className="flex flex-shrink-0 items-center space-x-2 text-xs">
                          <motion.span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${getStatusBg(task.status)}`}
                            variants={statusBadgeVariants} initial="initial" animate="animate" key={task.status}
                          >
                            {formatStatus(task.status)}
                          </motion.span>
                        </div>
                      </motion.div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                        <motion.div 
                          className="relative overflow-hidden"
                          variants={subtaskListVariants} initial="hidden" animate="visible" exit="hidden" layout
                        >
                          <div className="absolute top-0 bottom-0 left-[20px] border-l border-dashed border-zinc-700/50" />
                          <ul className="mt-1 mr-2 mb-1.5 ml-3 space-y-0.5">
                            {task.subtasks.map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="group flex flex-col py-0.5 pl-6"
                                  onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                  variants={subtaskVariants} initial="hidden" animate="visible" exit="exit" layout
                                >
                                  <motion.div 
                                    className="flex flex-1 items-center rounded-md p-1"
                                    whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", transition: { duration: 0.2 } }}
                                    layout
                                  >
                                    <motion.div className="mr-2 flex-shrink-0 cursor-pointer">
                                      {getStatusIcon(subtask.status)}
                                    </motion.div>
                                    <span className={`cursor-pointer text-xs ${subtask.status === "completed" || subtask.status === "done" ? "text-zinc-600 line-through" : "text-zinc-400"}`}>
                                      {subtask.title}
                                    </span>
                                  </motion.div>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}
