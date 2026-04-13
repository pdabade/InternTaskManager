import { useEffect, useState } from "react";
import {
  databases,
  DB_ID,
  TASKS_COLLECTION_ID,
  SUBMISSIONS_COLLECTION_ID,
  USERS_COLLECTION_ID,
  ID,
} from "../../lib/appwrite";
import { normalizeUrls } from "../../lib/submissionUrls";
import {
  approveSubmission,
  saveAdminEvaluation,
  evaluateSubmissionForAdmin,
} from "../../lib/submissionController";
import { useAuthContext } from "../../context/AuthContext";
import type { AppUser, Task, Submission, TaskStatus } from "../../types";

export default function AdminDashboard() {
  const { user, appUser } = useAuthContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "submissions">("tasks");

  // Create task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    estimatedEffort: "",
    status: "open" as TaskStatus,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [savingTaskStatusId, setSavingTaskStatusId] = useState<string | null>(
    null,
  );
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationModalSubmissionId, setEvaluationModalSubmissionId] =
    useState<string | null>(null);
  const [isEditingEvaluation, setIsEditingEvaluation] = useState(false);
  const [evaluationDraft, setEvaluationDraft] = useState({
    score: "",
    feedback: "",
    issuesText: "",
    strengthsText: "",
  });
  const [savingEvaluationId, setSavingEvaluationId] = useState<string | null>(
    null,
  );
  const [evaluatingSubmissionId, setEvaluatingSubmissionId] = useState<
    string | null
  >(null);
  const [approvingSubmissionId, setApprovingSubmissionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchSubmissions();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeUserId = (value: unknown) => {
    if (typeof value === "object" && value !== null && "$id" in value) {
      const documentId = (value as { $id?: unknown }).$id;
      return typeof documentId === "string" ? documentId : null;
    }

    return typeof value === "string" ? value : null;
  };

  const normalizeTaskRef = (value: unknown) => {
    if (typeof value === "object" && value !== null && "$id" in value) {
      return value as Task;
    }

    return typeof value === "string" ? value : "";
  };

  const normalizeSubmission = (submission: Submission) =>
    ({
      ...submission,
      submittedBy: normalizeUserId(submission.submittedBy) ?? "",
      reviewedBy: normalizeUserId(submission.reviewedBy),
      task: normalizeTaskRef(submission.task),
    }) as Submission;

  const normalizeTask = (task: Task) => {
    const rawStatus = (task as { status?: unknown }).status;

    return {
      ...task,
      status: rawStatus === "reviewed" ? "completed" : task.status,
      reviewedBy: normalizeUserId(task.reviewedBy),
    } as Task;
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await databases.listDocuments<Task>(
        DB_ID,
        TASKS_COLLECTION_ID,
      );
      setTasks((res.documents as Task[]).map(normalizeTask));
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const res = await databases.listDocuments<Submission>(
        DB_ID,
        SUBMISSIONS_COLLECTION_ID,
      );
      setSubmissions((res.documents as Submission[]).map(normalizeSubmission));
    } catch (e) {
      console.error("Failed to fetch submissions", e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await databases.listDocuments<AppUser>(
        DB_ID,
        USERS_COLLECTION_ID,
      );
      setUsers(res.documents as AppUser[]);
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setSubmitting(true);
    try {
      await databases.createDocument(DB_ID, TASKS_COLLECTION_ID, ID.unique(), {
        taskTitle: form.title,
        description: form.description,
        dueDate: form.dueDate,
        estimatedEffort: form.estimatedEffort,
        status: form.status,
      });
      setFormSuccess(true);
      setForm({
        title: "",
        description: "",
        dueDate: "",
        estimatedEffort: "",
        status: "open",
      });
      setShowTaskForm(false);
      fetchTasks();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTaskTitle = (taskRef: Submission["task"]) => {
    if (typeof taskRef === "object" && taskRef !== null) {
      return taskRef.taskTitle;
    }

    return tasks.find((task) => task.$id === taskRef)?.taskTitle ?? taskRef;
  };

  const getUserName = (userRef: string | null | undefined) => {
    if (!userRef) {
      return "—";
    }

    return users.find((user) => user.$id === userRef)?.name ?? userRef;
  };

  const adminId = appUser?.$id ?? user?.$id ?? null;

  const openTaskForm = () => {
    setForm({
      title: "",
      description: "",
      dueDate: "",
      estimatedEffort: "",
      status: "open",
    });
    setFormError(null);
    setFormSuccess(false);
    setShowTaskForm(true);
  };

  const parseEvaluationDetails = (submission: Submission) => {
    let issues: string[] = [];
    let strengths: string[] = [];

    if (submission.aiEvaluation) {
      try {
        const parsed = JSON.parse(submission.aiEvaluation);
        issues = Array.isArray(parsed.issues) ? parsed.issues : [];
        strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
      } catch {
        issues = [];
        strengths = [];
      }
    }

    return { issues, strengths };
  };

  const handleTaskStatusChange = async (
    taskId: string,
    status: Task["status"],
  ) => {
    if (!adminId) {
      setStatusError("You must be logged in to update task status.");
      return;
    }

    setStatusError(null);
    setSavingTaskStatusId(taskId);
    const currentTask = tasks.find((task) => task.$id === taskId);
    const reviewedBy =
      status === "open" ? null : (currentTask?.reviewedBy ?? null);
    try {
      await databases.updateDocument(DB_ID, TASKS_COLLECTION_ID, taskId, {
        status,
        reviewedBy,
      });
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.$id === taskId
            ? normalizeTask({ ...task, status, reviewedBy })
            : task,
        ),
      );
    } catch (e) {
      console.error("Failed to update task status", e);
      setStatusError(
        e instanceof Error ? e.message : "Failed to update task status.",
      );
    } finally {
      setSavingTaskStatusId(null);
    }
  };

  const openEvaluationModal = (
    submission: Submission,
    startInEditMode = false,
  ) => {
    const { issues, strengths } = parseEvaluationDetails(submission);
    setEvaluationError(null);
    setEvaluationModalSubmissionId(submission.$id);
    setIsEditingEvaluation(startInEditMode);
    setEvaluationDraft({
      score:
        typeof submission.aiScore === "number"
          ? String(submission.aiScore)
          : "",
      feedback: submission.aiFeedback ?? "",
      issuesText: issues.join("\n"),
      strengthsText: strengths.join("\n"),
    });
  };

  const closeEvaluationModal = () => {
    setEvaluationModalSubmissionId(null);
    setIsEditingEvaluation(false);
    setEvaluationDraft({
      score: "",
      feedback: "",
      issuesText: "",
      strengthsText: "",
    });
    setEvaluationError(null);
  };

  const replaceSubmission = (nextSubmission: Submission) => {
    setSubmissions((currentSubmissions) =>
      currentSubmissions.map((currentSubmission) =>
        currentSubmission.$id === nextSubmission.$id
          ? normalizeSubmission(nextSubmission)
          : currentSubmission,
      ),
    );
  };

  const handleRunEvaluation = async (submission: Submission) => {
    setEvaluationError(null);
    setEvaluatingSubmissionId(submission.$id);
    try {
      const updatedSubmission = await evaluateSubmissionForAdmin(
        submission.$id,
      );
      replaceSubmission(updatedSubmission);
    } catch (e) {
      console.error("Failed to evaluate submission", e);
      setEvaluationError(
        e instanceof Error ? e.message : "Failed to evaluate submission.",
      );
    } finally {
      setEvaluatingSubmissionId(null);
    }
  };

  const handleSaveEvaluation = async (submission: Submission) => {
    if (!adminId) {
      setEvaluationError("You must be logged in to save evaluation changes.");
      return;
    }

    const trimmedFeedback = evaluationDraft.feedback.trim();
    const parsedScore = Number(evaluationDraft.score);
    if (evaluationDraft.score && Number.isNaN(parsedScore)) {
      setEvaluationError("Score must be a valid number.");
      return;
    }

    if (trimmedFeedback.length === 0) {
      setEvaluationError("Feedback cannot be empty.");
      return;
    }

    setEvaluationError(null);
    setSavingEvaluationId(submission.$id);
    try {
      const updatedSubmission = await saveAdminEvaluation(
        submission.$id,
        {
          score: evaluationDraft.score ? parsedScore : null,
          feedback: trimmedFeedback,
          issues: normalizeUrls(
            evaluationDraft.issuesText.split("\n").map((item) => item.trim()),
          ),
          strengths: normalizeUrls(
            evaluationDraft.strengthsText
              .split("\n")
              .map((item) => item.trim()),
          ),
        },
        adminId,
      );
      replaceSubmission(updatedSubmission);
      openEvaluationModal(updatedSubmission, false);
    } catch (e) {
      console.error("Failed to save evaluation", e);
      setEvaluationError(
        e instanceof Error ? e.message : "Failed to save evaluation.",
      );
    } finally {
      setSavingEvaluationId(null);
    }
  };

  const handleApproveSubmission = async (submission: Submission) => {
    if (!adminId) {
      setEvaluationError("You must be logged in to approve a submission.");
      return;
    }

    if (!submission.aiEvaluation && !submission.aiFeedback) {
      setEvaluationError(
        "Run the AI evaluation before approving this submission.",
      );
      return;
    }

    setEvaluationError(null);
    setApprovingSubmissionId(submission.$id);
    try {
      const updatedSubmission = await approveSubmission(
        submission.$id,
        adminId,
      );
      replaceSubmission(updatedSubmission);
    } catch (e) {
      console.error("Failed to approve submission", e);
      setEvaluationError(
        e instanceof Error ? e.message : "Failed to approve submission.",
      );
    } finally {
      setApprovingSubmissionId(null);
    }
  };

  const activeEvaluationSubmission =
    submissions.find(
      (submission) => submission.$id === evaluationModalSubmissionId,
    ) ?? null;
  const activeEvaluationDetails = activeEvaluationSubmission
    ? parseEvaluationDetails(activeEvaluationSubmission)
    : { issues: [], strengths: [] };

  return (
    <div className="dashboard">
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks
        </button>
        <button
          className={`tab-btn ${activeTab === "submissions" ? "active" : ""}`}
          onClick={() => setActiveTab("submissions")}
        >
          Submissions
        </button>
      </div>

      {activeTab === "tasks" && (
        <div className="section">
          <div className="section-header">
            <h2>All Tasks</h2>
            <button className="btn-primary" onClick={openTaskForm}>
              + New Task
            </button>
          </div>

          {formSuccess && !showTaskForm && (
            <p className="success">Task created successfully.</p>
          )}

          {showTaskForm && (
            <form className="task-form" onSubmit={handleCreateTask}>
              {formError && <p className="error">{formError}</p>}

              <div className="field">
                <label>Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Due Date</label>
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Estimated Effort</label>
                <input
                  type="text"
                  placeholder="e.g. 3 days"
                  value={form.estimatedEffort}
                  onChange={(e) =>
                    setForm({ ...form, estimatedEffort: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as Task["status"],
                    })
                  }
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Task"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowTaskForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* <h2 style={{ marginTop: "2rem" }}>All Tasks</h2> */}
          {statusError && <p className="error">{statusError}</p>}
          {loadingTasks ? (
            <p>Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="empty">No tasks yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Effort</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.$id}>
                    <td>{task.taskTitle}</td>
                    <td>{task.description}</td>
                    <td>{new Date(task.dueDate).toLocaleDateString()}</td>
                    <td>{task.estimatedEffort}</td>
                    <td>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleTaskStatusChange(
                            task.$id,
                            e.target.value as Task["status"],
                          )
                        }
                        disabled={savingTaskStatusId === task.$id}
                      >
                        <option value="open">Open</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td>
                      {task.reviewedBy ? getUserName(task.reviewedBy) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "submissions" && (
        <div className="section">
          <h2>Intern Submissions</h2>
          {statusError && <p className="error">{statusError}</p>}
          {evaluationError && <p className="error">{evaluationError}</p>}
          {loadingSubmissions || loadingUsers || loadingTasks ? (
            <p>Loading submissions…</p>
          ) : submissions.length === 0 ? (
            <p className="empty">No submissions yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Task</th>
                  <th>Submitted By</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>URLs</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Score</th>
                  <th>Feedback</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.$id}>
                    <td>{sub.submissionTitle}</td>
                    <td>{getTaskTitle(sub.task)}</td>
                    <td>{getUserName(sub.submittedBy)}</td>
                    <td>{new Date(sub.submissionDate).toLocaleDateString()}</td>
                    <td>{sub.description}</td>
                    <td>
                      {normalizeUrls(sub.urls).length > 0 ? (
                        <div className="url-list">
                          {normalizeUrls(sub.urls).map((url, index) => (
                            <a
                              key={`${sub.$id}-url-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Link {index + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${sub.reviewStatus}`}>
                        {sub.reviewStatus === "pendingReview"
                          ? "Pending"
                          : "Reviewed"}
                      </span>
                    </td>
                    <td>
                      {sub.reviewedBy ? getUserName(sub.reviewedBy) : "—"}
                    </td>
                    <td>
                      {typeof sub.aiScore === "number" ? sub.aiScore : "—"}/10
                    </td>
                    <td>
                      {sub.aiEvaluatedAt ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => openEvaluationModal(sub)}
                        >
                          View Feedback
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {sub.isApprovedByAdmin ? "Approved" : "Pending approval"}
                    </td>
                    <td>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleRunEvaluation(sub)}
                          disabled={evaluatingSubmissionId === sub.$id}
                        >
                          {evaluatingSubmissionId === sub.$id
                            ? "Evaluating…"
                            : sub.aiEvaluatedAt
                              ? "Re-evaluate"
                              : "Evaluate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveSubmission(sub)}
                          disabled={
                            approvingSubmissionId === sub.$id ||
                            !sub.aiEvaluatedAt ||
                            sub.isApprovedByAdmin
                          }
                        >
                          {approvingSubmissionId === sub.$id
                            ? "Approving…"
                            : sub.isApprovedByAdmin
                              ? "Approved"
                              : "Approve"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {activeEvaluationSubmission && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={closeEvaluationModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluation-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="evaluation-modal-title">Evaluation Feedback</h3>
                <p className="modal-subtitle">
                  {activeEvaluationSubmission.submissionTitle}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={closeEvaluationModal}
              >
                Close
              </button>
            </div>

            {evaluationError && <p className="error">{evaluationError}</p>}

            {isEditingEvaluation ? (
              <div className="modal-body">
                <div className="field">
                  <label>Score</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={evaluationDraft.score}
                    onChange={(e) =>
                      setEvaluationDraft((current) => ({
                        ...current,
                        score: e.target.value,
                      }))
                    }
                    placeholder="Score"
                  />
                </div>
                <div className="field">
                  <label>Feedback</label>
                  <textarea
                    value={evaluationDraft.feedback}
                    onChange={(e) =>
                      setEvaluationDraft((current) => ({
                        ...current,
                        feedback: e.target.value,
                      }))
                    }
                    placeholder="Edit evaluation feedback"
                    rows={6}
                  />
                </div>
                <div className="field">
                  <label>Issues</label>
                  <textarea
                    value={evaluationDraft.issuesText}
                    onChange={(e) =>
                      setEvaluationDraft((current) => ({
                        ...current,
                        issuesText: e.target.value,
                      }))
                    }
                    placeholder="Issues, one per line"
                    rows={4}
                  />
                </div>
                <div className="field">
                  <label>Strengths</label>
                  <textarea
                    value={evaluationDraft.strengthsText}
                    onChange={(e) =>
                      setEvaluationDraft((current) => ({
                        ...current,
                        strengthsText: e.target.value,
                      }))
                    }
                    placeholder="Strengths, one per line"
                    rows={4}
                  />
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <div className="evaluation-grid">
                  <div className="evaluation-panel">
                    <span className="evaluation-label">Score</span>
                    <strong className="evaluation-score">
                      {typeof activeEvaluationSubmission.aiScore === "number"
                        ? `${activeEvaluationSubmission.aiScore}/10`
                        : "—"}
                    </strong>
                  </div>
                  <div className="evaluation-panel">
                    <span className="evaluation-label">Status</span>
                    <strong>
                      {activeEvaluationSubmission.isApprovedByAdmin
                        ? "Approved"
                        : "Pending approval"}
                    </strong>
                  </div>
                </div>

                <div className="evaluation-panel">
                  <span className="evaluation-label">Feedback</span>
                  <p className="evaluation-copy">
                    {activeEvaluationSubmission.aiFeedback ||
                      "No feedback yet."}
                  </p>
                </div>

                <div className="evaluation-grid">
                  <div className="evaluation-panel">
                    <span className="evaluation-label">Issues</span>
                    {activeEvaluationDetails.issues.length > 0 ? (
                      <ul className="evaluation-list">
                        {activeEvaluationDetails.issues.map((issue, index) => (
                          <li key={`issue-${index}`}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="evaluation-copy">No issues listed.</p>
                    )}
                  </div>
                  <div className="evaluation-panel">
                    <span className="evaluation-label">Strengths</span>
                    {activeEvaluationDetails.strengths.length > 0 ? (
                      <ul className="evaluation-list">
                        {activeEvaluationDetails.strengths.map(
                          (strength, index) => (
                            <li key={`strength-${index}`}>{strength}</li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p className="evaluation-copy">No strengths listed.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              {isEditingEvaluation ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveEvaluation(activeEvaluationSubmission)
                    }
                    disabled={
                      savingEvaluationId === activeEvaluationSubmission.$id
                    }
                  >
                    {savingEvaluationId === activeEvaluationSubmission.$id
                      ? "Saving…"
                      : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setIsEditingEvaluation(false)}
                    disabled={
                      savingEvaluationId === activeEvaluationSubmission.$id
                    }
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    openEvaluationModal(activeEvaluationSubmission, true)
                  }
                >
                  Edit Result
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
