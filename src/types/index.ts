import type { Models } from "appwrite";

export type UserRole = "admin" | "intern";

export interface AppUser extends Models.Document {
  role: UserRole;
  name: string;
  email: string;
}

export interface Task extends Models.Document {
  taskTitle: string;
  description: string;
  dueDate: string;
  status: "open" | "completed" | "reviewed";
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
  task: string;
  reviewedBy?: string | null;
  feedback?: string;
}
