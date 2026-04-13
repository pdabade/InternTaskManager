import type { Models } from "appwrite";

export type UserRole = "admin" | "intern";
export type TaskStatus = "open" | "completed";

export interface AppUser extends Models.Document {
  role: UserRole;
  name: string;
  email: string;
}

export interface Task extends Models.Document {
  taskTitle: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  estimatedEffort: string;
  reviewedBy?: string | null;
}

export interface Submission extends Models.Document {
  submissionDate: string;
  submittedBy: string; // user $id
  submissionTitle: string;
  description: string;
  urls: string[];
  reviewStatus: "pendingReview" | "reviewed";
  task: string | Task;
  reviewedBy?: string | null;
  feedback?: string;
  aiEvaluation?: string;
  aiScore?: number | null;
  aiFeedback?: string | null;
  aiEvaluatedAt?: string | null;
  isApprovedByAdmin?: boolean;
  approvedAt?: string | null;
}
