import { useCallback, useEffect, useMemo, useState } from "react";
import "./LocalStorage.css";

const API = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

function formatSize(bytes = 0) {
  const size = Number(bytes) || 0;

  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;

  return `${(size / 1024 ** 3).toFixed(2)} GB`;
}

function fileIcon(name = "") {
  const ext = String(name).split(".").pop().toLowerCase();

  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["ppt", "pptx"].includes(ext)) return "📊";

  return "📄";
}

function displayDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function LocalStorage() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [activeView, setActiveView] = useState("files");

  const [trashItems, setTrashItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const totalSize = useMemo(
    () =>
      files.reduce(
        (total, file) => total + (Number(file.size) || 0),
        0
      ),
    [files]
  );

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, options);

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;

      try {
        const data = await response.json();
        detail = data.detail || data.message || detail;
      } catch {
        // The response may not contain JSON.
      }

      throw new Error(detail);
    }

    if (response.status === 204) return null;

    return response;
  }, []);

  function showMessage(text, isError = false) {
    setMessage(text);
    setError(isError);
  }

  const loadFiles = useCallback(async () => {
    setLoading(true);

    try {
      const query = new URLSearchParams({ folder: currentFolder });

      if (search.trim()) {
        query.set("search", search.trim());
      }

      const [fileResponse, folderResponse] = await Promise.all([
        request(`/api/storage/files?${query.toString()}`),
        request(
          `/api/storage/folders?parent=${encodeURIComponent(currentFolder)}`
        ),
      ]);

      const fileData = await fileResponse.json();
      const folderData = await folderResponse.json();

      setFiles(Array.isArray(fileData.files) ? fileData.files : []);
      setFolders(Array.isArray(folderData.folders) ? folderData.folders : []);
      setSelectedFiles([]);
      setError(false);
    } catch (err) {
      showMessage(
        `${err.message}. Make sure the FileZen backend is running.`,
        true
      );
    } finally {
      setLoading(false);
    }
  }, [currentFolder, search, request]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);

    try {
      const response = await request("/api/storage/trash");
      const data = await response.json();

      setTrashItems(Array.isArray(data.items) ? data.items : []);
      setError(false);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setTrashLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleUpload(event) {
    const chosen = Array.from(event.target.files || []);
    event.target.value = "";

    if (!chosen.length) return;

    const form = new FormData();
    chosen.forEach((file) => form.append("files", file));

    setUploading(true);
    setMessage("");

    try {
      const response = await request(
        `/api/storage/upload?folder=${encodeURIComponent(currentFolder)}`,
        { method: "POST", body: form }
      );

      const result = await response.json();

      showMessage(
        `${result.files?.length || chosen.length} file(s) uploaded.`
      );

      await loadFiles();
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setUploading(false);
    }
  }

  async function createFolder() {
    const name = window.prompt("Enter a folder name:");

    if (!name?.trim()) return;

    try {
      const response = await request("/api/storage/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parent: currentFolder,
        }),
      });

      const result = await response.json();

      showMessage(`Folder "${result.name || name.trim()}" created.`);
      await loadFiles();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function downloadFile(file) {
    try {
      const response = await request(
        `/api/storage/download/${encodeURIComponent(file.id)}`
      );

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = file.name || "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function renameFile(file) {
    const name = window.prompt("Enter the new filename:", file.name);

    if (!name?.trim() || name.trim() === file.name) return;

    try {
      await request(
        `/api/storage/files/${encodeURIComponent(file.id)}/rename`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }
      );

      showMessage("File renamed successfully.");
      await loadFiles();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function deleteFile(file) {
    if (!window.confirm(`Move "${file.name}" to Trash?`)) return;

    try {
      await request(
        `/api/storage/files/${encodeURIComponent(file.id)}`,
        { method: "DELETE" }
      );

      showMessage("File moved to Trash.");
      await loadFiles();
      await loadTrash();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function deleteFolder(folder) {
    if (
      !window.confirm(
        `Move folder "${folder.name}" and its contents to Trash?`
      )
    ) {
      return;
    }

    try {
      await request(
        `/api/storage/folders?path=${encodeURIComponent(folder.path)}`,
        { method: "DELETE" }
      );

      showMessage(`Folder "${folder.name}" moved to Trash.`);
      await loadFiles();
      await loadTrash();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function restoreTrashItem(item) {
    if (!window.confirm(`Restore "${item.name}"?`)) return;

    try {
      await request(
        `/api/storage/trash/${encodeURIComponent(item.id)}/restore`,
        { method: "POST" }
      );

      showMessage(`"${item.name}" restored successfully.`);
      await loadTrash();
      await loadFiles();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function permanentlyDeleteTrashItem(item) {
    if (
      !window.confirm(
        `Permanently delete "${item.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await request(
        `/api/storage/trash/${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );

      showMessage(`"${item.name}" permanently deleted.`);
      await loadTrash();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function emptyTrash() {
    if (!trashItems.length) {
      showMessage("Trash is already empty.");
      return;
    }

    if (
      !window.confirm(
        "Permanently delete every item in Trash? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await request("/api/storage/trash", { method: "DELETE" });

      setTrashItems([]);
      showMessage("Trash emptied.");
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function downloadSelected() {
    const chosen = files.filter((file) =>
      selectedFiles.includes(file.id)
    );

    if (!chosen.length) {
      showMessage("Select at least one file to download.", true);
      return;
    }

    for (const file of chosen) {
      await downloadFile(file);
    }
  }

  function navigateToFolder(path) {
    setCurrentFolder(path);
    setSelectedFiles([]);
  }

  const breadcrumbs = currentFolder.split("/").filter(Boolean);

  return (
    <section className="local-storage-section" id="cloud-storage">
      <header className="local-storage-heading">
        <p className="local-storage-eyebrow">FILEZEN WORKSPACE</p>
        <h2>Cloud Storage</h2>
        <p>
          Save and organize files on this computer. Online access from other
          devices is not enabled in this local-storage version.
        </p>
      </header>

      <div className="storage-view-tabs">
        <button
          type="button"
          className={activeView === "files" ? "active" : ""}
          onClick={() => {
            setActiveView("files");
            loadFiles();
          }}
        >
          📁 My Files
        </button>

        <button
          type="button"
          className={activeView === "trash" ? "active" : ""}
          onClick={() => {
            setActiveView("trash");
            loadTrash();
          }}
        >
          🗑️ Trash ({trashItems.length})
        </button>
      </div>

      {message && (
        <p
          className={`storage-message ${error ? "is-error" : "is-success"}`}
          role="status"
        >
          {message}
        </p>
      )}

      {activeView === "files" ? (
        <>
          <div className="local-storage-summary">
            <div>
              <span className="storage-summary-icon">📁</span>
              <div>
                <strong>{files.length}</strong>
                <span>Files in this folder</span>
              </div>
            </div>

            <div>
              <span className="storage-summary-icon">💾</span>
              <div>
                <strong>{formatSize(totalSize)}</strong>
                <span>Current folder size</span>
              </div>
            </div>

            <div>
              <span className="storage-summary-icon">📂</span>
              <div>
                <strong>{folders.length}</strong>
                <span>Folders here</span>
              </div>
            </div>
          </div>

          <div className="local-storage-toolbar">
            <label className="storage-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search files by name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="storage-toolbar-actions">
              <button
                type="button"
                className="storage-secondary-button"
                onClick={createFolder}
              >
                + New folder
              </button>

              <label className="storage-primary-button">
                {uploading ? "Uploading..." : "↑ Upload files"}
                <input
                  type="file"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
            </div>
          </div>

          <div className="storage-breadcrumb">
            <button type="button" onClick={() => navigateToFolder("")}>
              My Files
            </button>

            {breadcrumbs.map((part, index) => {
              const path = breadcrumbs.slice(0, index + 1).join("/");

              return (
                <span key={path}>
                  <span className="breadcrumb-divider">/</span>
                  <button
                    type="button"
                    onClick={() => navigateToFolder(path)}
                  >
                    {part}
                  </button>
                </span>
              );
            })}

            <button
              type="button"
              className="storage-refresh-button"
              onClick={loadFiles}
              disabled={loading}
              title="Refresh files"
            >
              <span aria-hidden="true">↻</span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="storage-selection-bar">
              <span>{selectedFiles.length} selected</span>
              <button type="button" onClick={downloadSelected}>
                Download selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
              >
                Clear selection
              </button>
            </div>
          )}

          {loading ? (
            <div className="storage-empty-state">
              <span>⏳</span>
              <h3>Loading your files...</h3>
            </div>
          ) : (
            <div className="storage-table-wrap">
              <table className="storage-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Last modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {folders.map((folder) => (
                    <tr key={`folder-${folder.path}`}>
                      <td>📂</td>
                      <td>
                        <button
                          type="button"
                          className="storage-name-button"
                          onClick={() => navigateToFolder(folder.path)}
                        >
                          {folder.name}
                        </button>
                      </td>
                      <td>Folder</td>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        <button
                          type="button"
                          className="storage-action danger"
                          onClick={() => deleteFolder(folder)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>
                        <input
                          aria-label={`Select ${file.name}`}
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={(event) => {
                            setSelectedFiles((previous) =>
                              event.target.checked
                                ? [...previous, file.id]
                                : previous.filter((id) => id !== file.id)
                            );
                          }}
                        />
                      </td>

                      <td>
                        <span className="storage-file-name">
                          <span className="storage-file-icon">
                            {fileIcon(file.name)}
                          </span>
                          {file.name}
                        </span>
                      </td>

                      <td>{String(file.type || "file").toUpperCase()}</td>
                      <td>{formatSize(file.size)}</td>
                      <td>{displayDate(file.modified_at)}</td>

                      <td>
                        <div className="storage-row-actions">
                          <button
                            type="button"
                            className="storage-action"
                            onClick={() => downloadFile(file)}
                          >
                            Download
                          </button>

                          <button
                            type="button"
                            className="storage-action"
                            onClick={() => renameFile(file)}
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            className="storage-action danger"
                            onClick={() => deleteFile(file)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!folders.length && !files.length && (
                    <tr>
                      <td colSpan="6">
                        <div className="storage-empty-state">
                          <span>📂</span>
                          <h3>
                            {search ? "No matching files" : "This folder is empty"}
                          </h3>
                          <p>
                            {search
                              ? "Try another search term."
                              : "Upload files or create a folder to get started."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </>
      ) : (
        <div className="storage-trash-view">
          <div className="storage-trash-heading">
            <div>
              <h3>Trash &amp; Recovery</h3>
              <p>Restore deleted items or permanently remove them.</p>
            </div>

            <button
              type="button"
              className="storage-action danger"
              onClick={emptyTrash}
              disabled={!trashItems.length || trashLoading}
            >
              Empty Trash
            </button>
          </div>

          <button
            type="button"
            className="refresh-trash-button"
            onClick={loadTrash}
            disabled={trashLoading}
          >
            <span aria-hidden="true">↻</span>
            {trashLoading ? "Refreshing..." : "Refresh Trash"}
          </button>

          {trashLoading ? (
            <div className="storage-empty-state">
              <h3>Loading Trash...</h3>
            </div>
          ) : trashItems.length === 0 ? (
            <div className="storage-empty-state">
              <span>🗑️</span>
              <h3>Trash is empty</h3>
              <p>Files and folders you delete will appear here.</p>
            </div>
          ) : (
            <div className="storage-table-wrap">
              <table className="storage-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Item type</th>
                    <th>Original folder</th>
                    <th>Deleted on</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {trashItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="storage-file-name">
                          <span className="storage-file-icon">
                            {fileIcon(item.name)}
                          </span>
                          {item.name}
                        </span>
                      </td>

                      <td>{item.kind || "File"}</td>
                      <td>{item.original_folder || "My Files"}</td>
                      <td>
                        {item.trashed_at
                          ? displayDate(item.trashed_at * 1000)
                          : "—"}
                      </td>
                      <td>{formatSize(item.size)}</td>

                      <td>
                        <div className="storage-row-actions">
                          <button
                            type="button"
                            className="storage-action"
                            onClick={() => restoreTrashItem(item)}
                          >
                            Restore
                          </button>

                          <button
                            type="button"
                            className="storage-action danger"
                            onClick={() => permanentlyDeleteTrashItem(item)}
                          >
                            Delete permanently
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
