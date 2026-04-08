import { useEffect, useState } from "react";
import {
  databases,
  DB_ID,
  TASKS_COLLECTION_ID,
  SUBMISSIONS_COLLECTION_ID,
  ID,
  Query,
} from "../../lib/appwrite";
import { useAuthContext } from "../../context/AuthContext";
import type { Task, Submission } from "../../types";

export default function InternDashboard() {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "submissions">("tasks");

  // New submission form
  const [showForm, setShowForm] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(
    null,
  );
  const [form, setForm] = useState({
    submissionTitle: "",
    task: "",
    description: "",
    attachedFiles: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchMySubmissions();
  }, []);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await databases.listDocuments<Task>(
        DB_ID,
        TASKS_COLLECTION_ID,
      );
      setTasks(res.documents as Task[]);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchMySubmissions = async () => {
    if (!user) return;
    setLoadingSubmissions(true);
    try {
      const res = await databases.listDocuments<Submission>(
        DB_ID,
        SUBMISSIONS_COLLECTION_ID,
        [Query.equal("submittedBy", user.$id)],
      );
      setSubmissions(res.documents as Submission[]);
    } catch (e) {
      console.error("Failed to fetch submissions", e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const openNewForm = () => {
    setEditingSubmission(null);
    setForm({
      submissionTitle: "",
      task: "",
      description: "",
      attachedFiles: "",
    });
    setFormError(null);
    setFormSuccess(false);
    setShowForm(true);
  };

  const openEditForm = (sub: Submission) => {
    setEditingSubmission(sub);
    setForm({
      submissionTitle: sub.submissionTitle,
      task: sub.task,
      description: sub.description,
      attachedFiles: sub.attachedFiles ?? "",
    });
    setFormError(null);
    setFormSuccess(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setFormSuccess(false);
    setSubmitting(true);

    try {
      if (editingSubmission) {
        // Edit: only allow editing if still pending
        await databases.updateDocument(
          DB_ID,
          SUBMISSIONS_COLLECTION_ID,
          editingSubmission.$id,
          {
            submissionTitle: form.submissionTitle,
            task: form.task,
            description: form.description,
            attachedFiles: form.attachedFiles,
          },
        );
      } else {
        // New submission
        await databases.createDocument(
          DB_ID,
          SUBMISSIONS_COLLECTION_ID,
          ID.unique(),
          {
            submissionTitle: form.submissionTitle,
            task: form.task,
            description: form.description,
            attachedFiles: form.attachedFiles,
            submittedBy: user.$id,
            submissionDate: new Date().toISOString(),
            reviewStatus: "pendingReview",
          },
        );
      }

      setFormSuccess(true);
      setShowForm(false);
      fetchMySubmissions();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

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
          My Submissions
        </button>
      </div>

      {activeTab === "tasks" && (
        <div className="section">
          <h2>Available Tasks</h2>
          {loadingTasks ? (
            <p>Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="empty">No tasks assigned yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Effort</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.$id}>
                    <td>{task.taskTitle}</td>
                    <td>{task.description}</td>
                    <td>{task.dueDate}</td>
                    <td>{task.estimatedEffort}</td>
                    <td>
                      <span className={`badge badge-${task.status}`}>
                        {task.status}
                      </span>
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
          <div className="section-header">
            <h2>My Submissions</h2>
            <button className="btn-primary" onClick={openNewForm}>
              + New Submission
            </button>
          </div>

          {formSuccess && !showForm && (
            <p className="success">Submission saved successfully.</p>
          )}

          {showForm && (
            <form className="task-form" onSubmit={handleSubmit}>
              <h3>
                {editingSubmission ? "Edit Submission" : "New Submission"}
              </h3>
              {formError && <p className="error">{formError}</p>}

              <div className="field">
                <label>Submission Title</label>
                <input
                  type="text"
                  required
                  value={form.submissionTitle}
                  onChange={(e) =>
                    setForm({ ...form, submissionTitle: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Task</label>
                <select
                  required
                  value={form.task}
                  onChange={(e) => setForm({ ...form, task: e.target.value })}
                >
                  <option value="">Select a task…</option>
                  {tasks.map((t) => (
                    <option key={t.$id} value={t.$id}>
                      {t.taskTitle}
                    </option>
                  ))}
                </select>
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
                <label>Attached File URL</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={form.attachedFiles}
                  onChange={(e) =>
                    setForm({ ...form, attachedFiles: e.target.value })
                  }
                />
              </div>

              <div className="form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving…"
                    : editingSubmission
                      ? "Update"
                      : "Submit"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadingSubmissions ? (
            <p>Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="empty">No submissions yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Task</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.$id}>
                    <td>{sub.submissionTitle}</td>
                    <td>{sub.task}</td>
                    <td>{new Date(sub.submissionDate).toLocaleDateString()}</td>
                    <td>{sub.description}</td>
                    <td>
                      {sub.attachedFiles ? (
                        <a
                          href={sub.attachedFiles}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
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
                      {/* Only allow editing if still pending review */}
                      {sub.reviewStatus === "pendingReview" ? (
                        <button
                          className="btn-ghost"
                          onClick={() => openEditForm(sub)}
                        >
                          Edit
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
