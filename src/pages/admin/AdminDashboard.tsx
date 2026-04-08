import { useEffect, useState } from "react";
import {
  databases,
  DB_ID,
  TASKS_COLLECTION_ID,
  SUBMISSIONS_COLLECTION_ID,
  USERS_COLLECTION_ID,
  ID,
} from "../../lib/appwrite";
import type { AppUser, Task, Submission } from "../../types";

export default function AdminDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "submissions">("tasks");

  // Create task form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    estimatedEffort: "",
    status: "open" as Task["status"],
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchSubmissions();
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

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const res = await databases.listDocuments<Submission>(
        DB_ID,
        SUBMISSIONS_COLLECTION_ID,
      );
      setSubmissions(res.documents as Submission[]);
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
      await databases.createDocument(
        DB_ID,
        TASKS_COLLECTION_ID,
        ID.unique(),
        form,
      );
      setFormSuccess(true);
      setForm({
        title: "",
        description: "",
        dueDate: "",
        estimatedEffort: "",
        status: "open",
      });
      fetchTasks();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTaskTitle = (taskId: string) => {
    return tasks.find((task) => task.$id === taskId)?.taskTitle ?? taskId;
  };

  const getUserName = (userId: string) => {
    return users.find((user) => user.$id === userId)?.name ?? userId;
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
          Submissions
        </button>
      </div>

      {activeTab === "tasks" && (
        <div className="section">
          <h2>Create Task</h2>
          <form className="task-form" onSubmit={handleCreateTask}>
            {formError && <p className="error">{formError}</p>}
            {formSuccess && (
              <p className="success">Task created successfully.</p>
            )}

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
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
                  setForm({ ...form, status: e.target.value as Task["status"] })
                }
              >
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </form>

          <h2 style={{ marginTop: "2rem" }}>All Tasks</h2>
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
          <h2>Intern Submissions</h2>
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
                  <th>File</th>
                  <th>Status</th>
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
