"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckSquare, Square, Calendar, Loader2, Play, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createActivity } from "@/app/actions/activity-actions";

interface Task {
    id: string;
    title: string | null;
    description: string | null;
    due_date: string | null;
    priority: string;
    created_at: string;
    completed_at: string | null;
    owner_id: string;
    assigned_to: string;
    is_private: boolean;
}

export function TasksHubClient({ initialTasks, tenantId, userId }: { initialTasks: Task[], tenantId: string, userId: string }) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [filter, setFilter] = useState<'open' | 'completed'>('open');
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [newTaskSubject, setNewTaskSubject] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const supabase = createClient();

    const handleToggleComplete = async (task: Task) => {
        setCompletingId(task.id);
        const isCurrentlyCompleted = !!task.completed_at;
        const newCompletedAt = isCurrentlyCompleted ? null : new Date().toISOString();

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed_at: newCompletedAt } : t));

        const { error } = await supabase
            .from("activities")
            .update({ completed_at: newCompletedAt })
            .eq("id", task.id)
            .eq("tenant_id", tenantId);

        if (error) {
            toast.error("Failed to update task");
            // Revert
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        } else {
            toast.success(isCurrentlyCompleted ? "Task re-opened" : "Task marked complete!");
        }
        setCompletingId(null);
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskSubject.trim()) return;

        setIsCreating(true);
        try {
            const res = await createActivity({
                tenantId,
                activityType: "task",
                title: newTaskSubject.trim(),
                isTask: true,
                participants: [{ id: userId, type: "user", role: "assignee" }],
                priority: "normal",
            });

            if (res.success && res.activityId) {
                toast.success("Task created!");
                const newTask: Task = {
                    id: res.activityId,
                    title: newTaskSubject.trim(),
                    description: null,
                    due_date: null,
                    priority: "normal",
                    created_at: new Date().toISOString(),
                    completed_at: null,
                    owner_id: userId,
                    assigned_to: userId,
                    is_private: false,
                };
                setTasks(prev => [newTask, ...prev]);
                setNewTaskSubject("");
                setFilter('open'); // Switch to open tasks view to see the new task
            } else {
                toast.error(res.error || "Failed to create task");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsCreating(false);
        }
    };

    const filteredTasks = tasks.filter(t => filter === 'open' ? !t.completed_at : !!t.completed_at)
        .sort((a, b) => {
            // Sort by due date first if they exist
            if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            if (a.due_date) return -1;
            if (b.due_date) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
            </div>

            <form onSubmit={handleCreateTask} className="flex gap-2 mb-6">
                <Input
                    placeholder="What needs to be done?"
                    value={newTaskSubject}
                    onChange={(e) => setNewTaskSubject(e.target.value)}
                    className="flex-1 bg-card"
                    disabled={isCreating}
                />
                <Button type="submit" disabled={isCreating || !newTaskSubject.trim()}>
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Task
                </Button>
            </form>

            <div className="flex gap-2 mb-4">
                <Button
                    variant={filter === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('open')}
                >
                    Open Tasks
                </Button>
                <Button
                    variant={filter === 'completed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('completed')}
                >
                    Completed
                </Button>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-xl shadow-sm">
                    <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
                    <p className="text-muted-foreground">You have no {filter} tasks assigned to you right now.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredTasks.map(task => (
                        <div key={task.id} className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-start gap-4 transition-all hover:border-primary/30">
                            <button
                                onClick={() => handleToggleComplete(task)}
                                disabled={completingId === task.id}
                                className="mt-1 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                            >
                                {completingId === task.id ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                ) : task.completed_at ? (
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                    <Square className="h-5 w-5" />
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                <h4 className={`text-base font-semibold truncate ${task.completed_at ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {task.title || "Untitled Task"}
                                </h4>
                                {task.description && (
                                    <p className={`text-sm mt-1 line-clamp-2 ${task.completed_at ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                        {task.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                    {task.due_date && (
                                        <div className="flex items-center gap-1 font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md dark:bg-orange-500/10 dark:text-orange-400">
                                            <Calendar className="h-3 w-3" />
                                            Due {format(new Date(task.due_date), "MMM d, yyyy")}
                                        </div>
                                    )}
                                    {task.priority !== 'normal' && (
                                        <div className="capitalize font-medium text-foreground bg-secondary px-2 py-0.5 rounded-md">
                                            {task.priority} Priority
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
