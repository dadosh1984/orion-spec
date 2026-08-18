#!/usr/bin/env node
/**
 * Task Manager — CLI entry point
 * Cross-device todo organizer with sync, CLI + web, multi-platform
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DATA_DIR = join(homedir(), ".task-manager");
const DB_FILE = join(DATA_DIR, "tasks.json");

interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

function ensureDb(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, "[]", "utf8");
}

function readTasks(): Task[] {
  ensureDb();
  return JSON.parse(readFileSync(DB_FILE, "utf8"));
}

function writeTasks(tasks: Task[]): void {
  ensureDb();
  writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2), "utf8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addTask(title: string): Task {
  const tasks = readTasks();
  const task: Task = {
    id: generateId(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeTasks(tasks);
  return task;
}

function listTasks(filter?: "done" | "pending"): Task[] {
  const tasks = readTasks();
  if (filter === "done") return tasks.filter((t) => t.done);
  if (filter === "pending") return tasks.filter((t) => !t.done);
  return tasks;
}

function toggleTask(id: string): Task | null {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx].done = !tasks[idx].done;
  tasks[idx].updatedAt = new Date().toISOString();
  writeTasks(tasks);
  return tasks[idx];
}

function deleteTask(id: string): boolean {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  writeTasks(tasks);
  return true;
}

// CLI argument handling
const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "add": {
    const title = args.slice(1).join(" ");
    if (!title) { console.log("Usage: task-manager add <title>"); process.exit(1); }
    const task = addTask(title);
    console.log(`✅ Added: ${task.title} (${task.id})`);
    break;
  }
  case "list": {
    const filter = args[1] as "done" | "pending" | undefined;
    const tasks = listTasks(filter);
    if (tasks.length === 0) { console.log("No tasks found."); break; }
    for (const t of tasks) {
      console.log(`  ${t.done ? "✅" : "⬜"} ${t.title} (${t.id})`);
    }
    break;
  }
  case "done":
  case "toggle": {
    const id = args[1];
    if (!id) { console.log("Usage: task-manager done <id>"); process.exit(1); }
    const toggled = toggleTask(id);
    if (!toggled) { console.log(`Task ${id} not found.`); process.exit(1); }
    console.log(`✅ Toggled: ${toggled.title} → ${toggled.done ? "done" : "pending"}`);
    break;
  }
  case "delete":
  case "rm": {
    const id = args[1];
    if (!id) { console.log("Usage: task-manager delete <id>"); process.exit(1); }
    if (deleteTask(id)) console.log(`🗑️ Deleted task ${id}`);
    else { console.log(`Task ${id} not found.`); process.exit(1); }
    break;
  }
  default:
    console.log(`
Task Manager — CLI
  add <title>    Add a new task
  list [filter]  List tasks (done|pending)
  done <id>      Toggle task completion
  delete <id>    Delete a task
`);
}
