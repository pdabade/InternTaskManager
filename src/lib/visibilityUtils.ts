/**
 * Sanitizes submission data based on user role.
 * Intern: Hides evaluation details unless approved by admin.
 * Admin: Full access.
 */
type SubmissionVisibilityShape = {
  isApprovedByAdmin?: boolean;
  aiEvaluation?: string;
  aiScore?: number | null;
  aiFeedback?: string | null;
  aiEvaluatedAt?: string | null;
  approvedAt?: string | null;
};

export function sanitizeSubmissionVisibility<T extends SubmissionVisibilityShape>(
  submission: T,
  role: "intern" | "admin",
) {
  if (role === 'admin') {
    return submission;
  }
  
  if (role === 'intern' && !submission.isApprovedByAdmin) {
    const safeSubmission = { ...submission };
    delete safeSubmission.aiEvaluation;
    delete safeSubmission.aiScore;
    delete safeSubmission.aiFeedback;
    delete safeSubmission.aiEvaluatedAt;
    delete safeSubmission.approvedAt;
    delete safeSubmission.isApprovedByAdmin;
    return safeSubmission;
  }
  
  return submission;
}
