
import { useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import "./ProductivityTools.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const TOOLS = [
  {
    id: "preview",
    icon: "📘",
    title: "PDF Preview",
    description: "Preview a PDF and select pages to extract.",
  },
  {
    id: "images",
    icon: "🖼️",
    title: "Images to PDF",
    description: "Combine PNG and JPEG images into one PDF.",
  },
  {
    id: "zip",
    icon: "🗜️",
    title: "Download as ZIP",
    description: "Package multiple files into one ZIP archive.",
  },
  {
    id: "history",
    icon: "🕘",
    title: "Conversion History",
    description: "Review completed actions in this session.",
  },
  {
    id: "ai",
    icon: "🤖",
    title: "AI Chat with PDF",
    description: "Ask questions about your PDF documents.",
  },
  {
    id: "storage",
    icon: "☁️",
    title: "Cloud Storage",
    description: "View information about account and storage support.",
  },
  {
    id: "cleanup",
    icon: "🛡️",
    title: "File Security",
    description: "Clear selected files from the current workspace.",
  },
];

const ACCEPTED_IMAGES = [".png", ".jpg", ".jpeg"];

function isPdf(file) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function isImage(file) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") &&
    ACCEPTED_IMAGES.some((extension) => name.endsWith(extension))
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProductivityTools() {
  const [activeTool, setActiveTool] = useState("preview");

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [imageFiles, setImageFiles] = useState([]);
  const [zipFiles, setZipFiles] = useState([]);

  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [working, setWorking] = useState(false);

  const currentTool = useMemo(
    () => TOOLS.find((tool) => tool.id === activeTool) || TOOLS[0],
    [activeTool]
  );

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function notify(message, isError = false) {
    setStatus(message);
    setError(isError);
  }

  function recordAction(action, filename) {
    setHistory((previous) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        action,
        filename,
        time: new Date().toLocaleString(),
      },
      ...previous,
    ]);
  }

  function selectPdf(event) {
    const file = event.target.files?.[0];

    setStatus("");
    setError(false);
    setPdfPageCount(0);
    setSelectedPages([]);
    setAiAnswer("");

    if (!file) {
      setPdfFile(null);
      setPdfUrl("");
      return;
    }

    if (!isPdf(file)) {
      setPdfFile(null);
      setPdfUrl("");
      notify("Please choose a PDF file.", true);
      event.target.value = "";
      return;
    }

    setPdfFile(file);
    setPdfUrl(URL.createObjectURL(file));
    setPdfLoading(true);

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const pdf = await PDFDocument.load(reader.result);
        const count = pdf.getPageCount();

        setPdfPageCount(count);
        setSelectedPages(Array.from({ length: count }, (_, index) => index));
        notify(`PDF loaded successfully. ${count} pages found.`);
      } catch {
        setPdfFile(null);
        setPdfUrl("");
        notify(
          "This PDF could not be opened. It may be encrypted or damaged.",
          true
        );
      } finally {
        setPdfLoading(false);
      }
    };

    reader.onerror = () => {
      setPdfLoading(false);
      notify("Could not read the selected PDF.", true);
    };

    reader.readAsArrayBuffer(file);
  }

  function togglePage(pageIndex) {
    setSelectedPages((previous) =>
      previous.includes(pageIndex)
        ? previous.filter((page) => page !== pageIndex)
        : [...previous, pageIndex].sort((a, b) => a - b)
    );
  }

  function selectAllPages() {
    setSelectedPages(
      Array.from({ length: pdfPageCount }, (_, index) => index)
    );
  }

  function clearPageSelection() {
    setSelectedPages([]);
  }

  async function extractPages() {
    if (!pdfFile) {
      notify("Choose a PDF first.", true);
      return;
    }

    if (!selectedPages.length) {
      notify("Select at least one page to extract.", true);
      return;
    }

    setWorking(true);

    try {
      const sourceBytes = await pdfFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(sourceBytes);
      const outputPdf = await PDFDocument.create();

      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        selectedPages
      );

      copiedPages.forEach((page) => outputPdf.addPage(page));

      const bytes = await outputPdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const filename = "filezen-selected-pages.pdf";

      downloadBlob(blob, filename);
      recordAction("Extract PDF pages", filename);
      notify(`Downloaded ${selectedPages.length} selected page(s).`);
    } catch (err) {
      notify(err.message || "Could not extract PDF pages.", true);
    } finally {
      setWorking(false);
    }
  }

  async function convertImagesToPdf() {
    if (!imageFiles.length) {
      notify("Choose one or more PNG or JPEG images first.", true);
      return;
    }

    const invalidFiles = imageFiles.filter((file) => !isImage(file));

    if (invalidFiles.length) {
      notify("Only PNG and JPEG images are supported.", true);
      return;
    }

    setWorking(true);

    try {
      const outputPdf = await PDFDocument.create();

      for (const file of imageFiles) {
        const bytes = await file.arrayBuffer();
        const lowerName = file.name.toLowerCase();

        const image = lowerName.endsWith(".png")
          ? await outputPdf.embedPng(bytes)
          : await outputPdf.embedJpg(bytes);

        const page = outputPdf.addPage([image.width, image.height]);

        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const bytes = await outputPdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const filename = "filezen-images.pdf";

      downloadBlob(blob, filename);
      recordAction("Convert images to PDF", filename);
      notify(`Converted ${imageFiles.length} image(s) into one PDF.`);
    } catch (err) {
      notify(
        err.message ||
          "Image conversion failed. Check that your images are valid PNG or JPEG files.",
        true
      );
    } finally {
      setWorking(false);
    }
  }

  async function downloadZip() {
    if (!zipFiles.length) {
      notify("Choose files to include in the ZIP archive.", true);
      return;
    }

    setWorking(true);

    try {
      const zip = new JSZip();

      zipFiles.forEach((file) => {
        // Keep duplicate filenames distinct within the archive.
        const safeName = file.name.replace(/[\\/]/g, "_");
        zip.file(safeName, file);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const filename = "filezen-downloads.zip";

      downloadBlob(blob, filename);
      recordAction("Create ZIP archive", filename);
      notify(`Created ZIP archive containing ${zipFiles.length} file(s).`);
    } catch (err) {
      notify(err.message || "Could not create the ZIP archive.", true);
    } finally {
      setWorking(false);
    }
  }

  async function askAboutPdf(event) {
    event.preventDefault();

    if (!pdfFile) {
      notify("Upload a PDF in the PDF Preview section first.", true);
      return;
    }

    if (!question.trim()) {
      notify("Enter a question about your PDF.", true);
      return;
    }

    setAiLoading(true);
    setAiAnswer("");
    setStatus("");
    setError(false);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("question", question.trim());

      // This endpoint must exist on your backend.
      const response = await fetch(`${API_BASE}/api/ai/chat-with-pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `AI request failed (${response.status}). Check your backend endpoint.`
        );
      }

      const answer =
        data.answer || data.response || data.message || data.summary;

      if (!answer) {
        throw new Error("The AI endpoint returned no answer.");
      }

      setAiAnswer(String(answer));
      recordAction("AI chat with PDF", pdfFile.name);
    } catch (err) {
      notify(
        err.message ||
          "Could not contact the AI service. Make sure the backend is running and configured.",
        true
      );
    } finally {
      setAiLoading(false);
    }
  }

  function clearWorkspace() {
    setPdfFile(null);
    setPdfPageCount(0);
    setSelectedPages([]);
    setPdfUrl("");
    setImageFiles([]);
    setZipFiles([]);
    setQuestion("");
    setAiAnswer("");
    setHistory([]);
    setStatus("");
    setError(false);

    const inputs = document.querySelectorAll(
      ".productivity-section input[type='file']"
    );

    inputs.forEach((input) => {
      input.value = "";
    });
  }

  function renderActiveWorkspace() {
    switch (activeTool) {
      case "preview":
        return (
          <>
            <p>
              Upload a PDF, preview it, choose the pages you want, and
              download a new PDF containing only those pages.
            </p>

            <label htmlFor="productivity-pdf-upload">
              Choose a PDF
            </label>
            <input
              id="productivity-pdf-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={selectPdf}
            />

            {pdfFile && (
              <p className="productivity-file-info">
                <strong>{pdfFile.name}</strong>
                <span>{formatSize(pdfFile.size)}</span>
              </p>
            )}

            {pdfLoading && <p>Reading PDF…</p>}

            {pdfFile && pdfPageCount > 0 && (
              <>
                <div className="productivity-selection-toolbar">
                  <p>
                    {selectedPages.length} of {pdfPageCount} pages selected
                  </p>
                  <div>
                    <button
                      className="productivity-button secondary"
                      type="button"
                      onClick={selectAllPages}
                    >
                      Select all
                    </button>
                    <button
                      className="productivity-button secondary"
                      type="button"
                      onClick={clearPageSelection}
                    >
                      Clear selection
                    </button>
                  </div>
                </div>

                <div className="productivity-page-list">
                  {Array.from({ length: pdfPageCount }, (_, index) => (
                    <label className="productivity-page" key={index}>
                      <span>
                        <input
                          type="checkbox"
                          checked={selectedPages.includes(index)}
                          onChange={() => togglePage(index)}
                        />
                        Page {index + 1}
                      </span>
                      <span className="productivity-page-number">
                        {index + 1}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  className="productivity-button"
                  type="button"
                  onClick={extractPages}
                  disabled={working || !selectedPages.length}
                >
                  {working ? "Processing…" : "Download selected pages"}
                </button>

                <h4>PDF preview</h4>
                <iframe
                  className="productivity-pdf-preview"
                  src={pdfUrl}
                  title="Selected PDF preview"
                />
              </>
            )}
          </>
        );

      case "images":
        return (
          <>
            <p>
              Select multiple PNG or JPEG images to combine them into one
              downloadable PDF. Images are processed in the order selected.
            </p>

            <label htmlFor="productivity-image-upload">
              Choose images
            </label>
            <input
              id="productivity-image-upload"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              multiple
              onChange={(event) => {
                setImageFiles(Array.from(event.target.files || []));
                setStatus("");
                setError(false);
              }}
            />

            <FileList files={imageFiles} />

            <button
              className="productivity-button"
              type="button"
              onClick={convertImagesToPdf}
              disabled={working || !imageFiles.length}
            >
              {working ? "Converting…" : "Convert images to PDF"}
            </button>
          </>
        );

      case "zip":
        return (
          <>
            <p>
              Choose any files you want to package together. This creates a
              ZIP download directly in your browser.
            </p>

            <label htmlFor="productivity-zip-upload">
              Choose files for ZIP
            </label>
            <input
              id="productivity-zip-upload"
              type="file"
              multiple
              onChange={(event) => {
                setZipFiles(Array.from(event.target.files || []));
                setStatus("");
                setError(false);
              }}
            />

            <FileList files={zipFiles} />

            <button
              className="productivity-button"
              type="button"
              onClick={downloadZip}
              disabled={working || !zipFiles.length}
            >
              {working ? "Creating ZIP…" : "Download ZIP"}
            </button>
          </>
        );

      case "history":
        return (
          <>
            <p>
              Completed actions are listed here for the current browser
              session. The history is not saved to a server.
            </p>

            {history.length === 0 ? (
              <p className="productivity-empty">
                No completed actions yet. Use a tool to create your first
                history entry.
              </p>
            ) : (
              <ul className="productivity-history">
                {history.map((item) => (
                  <li key={item.id}>
                    <strong>{item.action}</strong>
                    <span>{item.filename}</span>
                    <small>{item.time}</small>
                  </li>
                ))}
              </ul>
            )}

            <button
              className="productivity-button secondary"
              type="button"
              onClick={() => {
                setHistory([]);
                notify("Conversion history cleared.");
              }}
            >
              Clear history
            </button>
          </>
        );

      case "ai":
        return (
          <>
            <p>
              Ask a question about the PDF uploaded in the PDF Preview
              section. This feature requires a matching AI endpoint on your
              backend.
            </p>

            {pdfFile ? (
              <p className="productivity-file-info">
                <strong>Selected PDF:</strong>
                <span>{pdfFile.name}</span>
              </p>
            ) : (
              <p className="productivity-note">
                Upload a PDF first using the PDF Preview tool.
              </p>
            )}

            <form onSubmit={askAboutPdf}>
              <label htmlFor="productivity-ai-question">
                Your question
              </label>
              <textarea
                id="productivity-ai-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Summarize this document…"
                rows={4}
              />

              <button
                className="productivity-button"
                type="submit"
                disabled={aiLoading || !pdfFile}
              >
                {aiLoading ? "Thinking…" : "Ask about PDF"}
              </button>
            </form>

            {aiAnswer && (
              <div className="productivity-answer">
                <h4>AI response</h4>
                <p>{aiAnswer}</p>
              </div>
            )}
          </>
        );

      case "storage":
        return (
          <>
            <p>
              FileZen currently processes these files locally in your
              browser for the features implemented here.
            </p>
            <p className="productivity-note">
              Account registration, secure sign-in, and persistent cloud
              storage require backend authentication, storage configuration,
              and access controls. They are not implemented by this component.
            </p>
          </>
        );

      case "cleanup":
        return (
          <>
            <p>
              Clear the currently selected files, PDF preview, AI response,
              and session history from this workspace.
            </p>
            <p className="productivity-note">
              This clears local workspace state. It does not delete files
              from your Mac or remove files already uploaded to a backend.
            </p>

            <button
              className="productivity-button danger"
              type="button"
              onClick={clearWorkspace}
            >
              Clear current workspace
            </button>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <section className="productivity-section" id="productivity-tools">
      <header className="productivity-heading">
        <p className="productivity-eyebrow">FILEZEN WORKSPACE</p>
        <h2>More ways to work with files</h2>
        <p>
          Preview, organize, convert, and manage your documents.
        </p>
      </header>

      <div className="productivity-tools-grid">
        {TOOLS.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={`productivity-tool-card ${
              activeTool === tool.id ? "selected" : ""
            }`}
            onClick={() => {
              setActiveTool(tool.id);
              setStatus("");
              setError(false);
            }}
            aria-pressed={activeTool === tool.id}
          >
            <span className="productivity-tool-icon" aria-hidden="true">
              {tool.icon}
            </span>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
          </button>
        ))}
      </div>

      <section className="productivity-panel" aria-live="polite">
        <div className="productivity-workspace-heading">
          <span className="productivity-tool-icon" aria-hidden="true">
            {currentTool.icon}
          </span>
          <div>
            <p className="productivity-workspace-eyebrow">
              SELECTED TOOL
            </p>
            <h3>{currentTool.title}</h3>
            <p>{currentTool.description}</p>
          </div>
        </div>

        <div className="productivity-workspace-content">
          {renderActiveWorkspace()}
        </div>

        {status && (
          <p
            className={`productivity-status ${
              error ? "error" : "success"
            }`}
            role="status"
          >
            {status}
          </p>
        )}
      </section>
    </section>
  );
}

function FileList({ files }) {
  if (!files.length) {
    return (
      <p className="productivity-empty">
        No files selected yet.
      </p>
    );
  }

  return (
    <ul className="productivity-file-list">
      {files.map((file, index) => (
        <li key={`${file.name}-${file.size}-${index}`}>
          <span>{file.name}</span>
          <small>{formatSize(file.size)}</small>
        </li>
      ))}
    </ul>
  );
}
