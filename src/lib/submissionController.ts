import type { Submission } from "../types";
import { extractGitUrl, fetchRepositoryCode } from "./gitUtils";
import { evaluateSubmission } from "./aiEvaluator";
import {
  databases,
  DB_ID,
  SUBMISSIONS_COLLECTION_ID,
  TASKS_COLLECTION_ID,
} from "./appwrite";
import { normalizeUrls } from "./submissionUrls";

export interface AdminEvaluationDraft {
  score?: number | null;
  feedback?: string;
  issues?: string[];
  strengths?: string[];
}

const parseStoredEvaluation = (value?: string | null): AdminEvaluationDraft => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return {
      score: typeof parsed.score === "number" ? parsed.score : null,
      feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    };
  } catch {
    return {};
  }
};

const serializeEvaluation = (draft: AdminEvaluationDraft) =>
  JSON.stringify({
    score: typeof draft.score === "number" ? draft.score : null,
    feedback: draft.feedback?.trim() ?? "",
    issues: draft.issues ?? [],
    strengths: draft.strengths ?? [],
  });

const getSubmissionGitSource = (submission: Submission) => {
  const urls = normalizeUrls(submission.urls);
  const combinedSource = [submission.description, ...urls].filter(Boolean).join("\n");
  return extractGitUrl(combinedSource);
};

const getSubmissionTaskId = (submission: Submission) =>
  typeof submission.task === "object" && submission.task !== null
    ? submission.task.$id
    : submission.task;

export async function evaluateSubmissionForAdmin(submissionId: string) {
  const submission = await databases.getDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
  );

  const gitUrl = getSubmissionGitSource(submission);
  const aiEvaluatedAt = new Date().toISOString();

  if (!gitUrl) {
    return databases.updateDocument<Submission>(
      DB_ID,
      SUBMISSIONS_COLLECTION_ID,
      submissionId,
      {
        aiEvaluation: serializeEvaluation({
          feedback: "No valid Git repository URL was found in the submission.",
          issues: ["No valid Git repository URL was found in the submission."],
          strengths: [],
        }),
        aiScore: null,
        aiFeedback: "No valid Git repository URL was found in the submission.",
        aiEvaluatedAt,
        isApprovedByAdmin: false,
        approvedAt: null,
      },
    );
  }

  const code = await fetchRepositoryCode(gitUrl);
  const task = await databases.getDocument(
    DB_ID,
    TASKS_COLLECTION_ID,
    getSubmissionTaskId(submission),
  );
  const taskDescription = task.description || task.taskTitle || "No description provided.";
  const evaluation = await evaluateSubmission(taskDescription, code);

  const nextEvaluation: AdminEvaluationDraft = evaluation.error
    ? {
        score: null,
        feedback: evaluation.error,
        issues: [evaluation.error],
        strengths: [],
      }
    : {
        score: evaluation.score ?? null,
        feedback: evaluation.feedback ?? "",
        issues: evaluation.issues ?? [],
        strengths: evaluation.strengths ?? [],
      };

  return databases.updateDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
    {
      aiEvaluation: serializeEvaluation(nextEvaluation),
      aiScore: nextEvaluation.score ?? null,
      aiFeedback: nextEvaluation.feedback ?? "",
      aiEvaluatedAt,
      isApprovedByAdmin: false,
      approvedAt: null,
    },
  );
}

export async function saveAdminEvaluation(
  submissionId: string,
  draft: AdminEvaluationDraft,
  adminId?: string | null,
) {
  const currentSubmission = await databases.getDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
  );

  const currentEvaluation = parseStoredEvaluation(currentSubmission.aiEvaluation);
  const nextEvaluation: AdminEvaluationDraft = {
    score:
      typeof draft.score === "number"
        ? draft.score
        : (currentEvaluation.score ?? null),
    feedback: draft.feedback?.trim() ?? currentEvaluation.feedback ?? "",
    issues: draft.issues ?? currentEvaluation.issues ?? [],
    strengths: draft.strengths ?? currentEvaluation.strengths ?? [],
  };

  return databases.updateDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
    {
      aiEvaluation: serializeEvaluation(nextEvaluation),
      aiScore: nextEvaluation.score ?? null,
      aiFeedback: nextEvaluation.feedback ?? "",
      aiEvaluatedAt: currentSubmission.aiEvaluatedAt ?? new Date().toISOString(),
      reviewedBy: adminId ?? currentSubmission.reviewedBy ?? null,
      isApprovedByAdmin: false,
      approvedAt: null,
    },
  );
}

export async function approveSubmission(
  submissionId: string,
  adminId?: string | null,
) {
  const submission = await databases.getDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
  );
  const currentEvaluation = parseStoredEvaluation(submission.aiEvaluation);

  return databases.updateDocument<Submission>(
    DB_ID,
    SUBMISSIONS_COLLECTION_ID,
    submissionId,
    {
      aiEvaluation: serializeEvaluation(currentEvaluation),
      aiScore: currentEvaluation.score ?? submission.aiScore ?? null,
      aiFeedback: currentEvaluation.feedback ?? submission.aiFeedback ?? "",
      reviewStatus: "reviewed",
      reviewedBy: adminId ?? submission.reviewedBy ?? null,
      isApprovedByAdmin: true,
      approvedAt: new Date().toISOString(),
    },
  );
}
