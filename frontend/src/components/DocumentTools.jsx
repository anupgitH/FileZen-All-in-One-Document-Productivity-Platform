import { useState } from "react";
import "./DocumentTools.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const DOCUMENT_TOOLS = [
  {
    id: "pdf-word",
    icon: "📘",
    title: "PDF to Word",
    description: "Convert PDF documents into Word files.",
    accept: ".pdf",
    endpoint: "/api/documents/pdf-to-word",
    output: "converted.docx",
  },
  {
    id: "pdf-ppt",
    icon: "📊",
    title: "PDF to PowerPoint",
    description: "Convert PDF pages into a presentation.",
    accept: ".pdf",
    endpoint: "/api/documents/pdf-to-powerpoint",
    output: "converted.pptx",
  },
  {
    id: "pdf-excel",
    icon: "📗",
    title: "PDF to Excel",
    description: "Extract PDF tables into spreadsheets.",
    accept: ".pdf",
    endpoint: "/api/documents/pdf-to-excel",
    output: "converted.xlsx",
  },
  {
    id: "word-pdf",
    icon: "📄",
    title: "Word to PDF",
    description: "Convert Word documents into PDFs.",
    accept: ".doc,.docx",
    endpoint: "/api/documents/word-to-pdf",
    output: "converted.pdf",
  },
  {
    id: "ppt-pdf",
    icon: "📽️",
    title: "PowerPoint to PDF",
    description: "Convert presentations into PDFs.",
    accept: ".ppt,.pptx",
    endpoint: "/api/documents/powerpoint-to-pdf",
    output: "converted.pdf",
  },
  {
    id: "excel-pdf",
    icon: "📈",
    title: "Excel to PDF",
    description: "Convert spreadsheets into PDFs.",
    accept: ".xls,.xlsx",
    endpoint: "/api/documents/excel-to-pdf",
    output: "converted.pdf",
  },
  {
    id: "edit-pdf",
    icon: "✏️",
    title: "Edit PDF",
    description: "Add text or highlights to PDF pages.",
    accept: ".pdf",
    endpoint: "/api/documents/edit-pdf",
    output: "edited.pdf",
  },
  {
    id: "page-numbers",
    icon: "🔢",
    title: "Add Page Numbers",
    description: "Add page numbers to every PDF page.",
    accept: ".pdf",
    endpoint: "/api/documents/page-numbers",
    output: "numbered.pdf",
  },
  {
    id: "scan-pdf",
    icon: "📷",
    title: "Scan to PDF",
    description: "Combine scanned images into one PDF.",
    accept: "image/*",
    endpoint: "/api/documents/scan-to-pdf",
    output: "scanned.pdf",
    multiple: true,
    fieldName: "files",
  },
  {
    id: "ocr-pdf",
    icon: "🔎",
    title: "OCR PDF",
    description: "Recognize text in scanned documents.",
    accept: ".pdf",
    endpoint: "/api/documents/ocr-pdf",
    output: "searchable.pdf",
  },
  {
    id: "compare-pdf",
    icon: "⚖️",
    title: "Compare PDF",
    description: "Compare two PDF files for differences.",
    accept: ".pdf",
    endpoint: "/api/documents/compare-pdf",
    output: "comparison.pdf",
    multiple: true,
    fieldName: "files",
    minFiles: 2,
    maxFiles: 2,
  },
  {
    id: "redact-pdf",
    icon: "🛡️",
    title: "Redact PDF",
    description: "Permanently remove sensitive content.",
    accept: ".pdf",
    endpoint: "/api/documents/redact-pdf",
    output: "redacted.pdf",
  },
  {
    id: "crop-pdf",
    icon: "✂️",
    title: "Crop PDF",
    description: "Trim PDF page margins.",
    accept: ".pdf",
    endpoint: "/api/documents/crop-pdf",
    output: "cropped.pdf",
  },
  {
    id: "pdf-forms",
    icon: "📝",
    title: "PDF Forms",
    description: "Work with interactive PDF form fields.",
    accept: ".pdf",
    endpoint: "/api/documents/pdf-forms",
    output: "filled-form.pdf",
  },
  {
    id: "ai-summary",
    icon: "🤖",
    title: "AI Summarizer",
    description: "Summarize long documents into key points.",
    accept: ".pdf",
    endpoint: "/api/documents/ai-summarize",
    output: "summary.md",
  },
  {
    id: "translate-pdf",
    icon: "🌐",
    title: "Translate PDF",
    description: "Translate PDF content into another language.",
    accept: ".pdf",
    endpoint: "/api/documents/translate-pdf",
    output: "translated.pdf",
  },
  {
    id: "pdf-markdown",
    icon: "📰",
    title: "PDF to Markdown",
    description: "Extract PDF content into Markdown.",
    accept: ".pdf",
    endpoint: "/api/documents/pdf-to-markdown",
    output: "document.md",
  },
];

export default function DocumentTools() {
  const [selectedTool, setSelectedTool] = useState("pdf-word");

  const activeTool = DOCUMENT_TOOLS.find(
    (tool) => tool.id === selectedTool
  );

  return (
    <section className="document-tools-section" id="document-tools">
      <div className="document-tools-heading">
        <p className="document-eyebrow">DOCUMENT WORKSPACE</p>
        <h2>Document Tools</h2>
        <p>
          Convert, secure, organize, and improve your documents in one place.
        </p>
      </div>

      <div className="document-tools-grid">
        {DOCUMENT_TOOLS.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={`document-tool-card ${
              selectedTool === tool.id ? "selected" : ""
            }`}
            onClick={() => setSelectedTool(tool.id)}
            aria-pressed={selectedTool === tool.id}
          >
            <span className="document-tool-icon">{tool.icon}</span>

            <strong>{tool.title}</strong>

            <span className="document-tool-description">
              {tool.description}
            </span>
          </button>
        ))}
      </div>

      <div className="document-tool-workspace">
        <div className="document-workspace-heading">
          <span className="document-tool-icon">{activeTool.icon}</span>

          <div>
            <h3>{activeTool.title}</h3>
            <p>{activeTool.description}</p>
          </div>
        </div>

        <DocumentToolForm
          key={selectedTool}
          tool={activeTool}
        />
      </div>
    </section>
  );
}

function DocumentToolForm({ tool }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  function handleFileChange(event) {
    setFiles(Array.from(event.target.files || []));
    setMessage("");
    setError(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (files.length === 0) {
      setError(true);
      setMessage("Please select a file first.");
      return;
    }

    if (
      tool.minFiles &&
      files.length < tool.minFiles
    ) {
      setError(true);
      setMessage(`Please select at least ${tool.minFiles} files.`);
      return;
    }

    if (
      tool.maxFiles &&
      files.length > tool.maxFiles
    ) {
      setError(true);
      setMessage(`Please select exactly ${tool.maxFiles} files.`);
      return;
    }

    setLoading(true);
    setMessage("");
    setError(false);

    try {
      const formData = new FormData();

      if (tool.multiple) {
        files.forEach((file) => {
          formData.append(tool.fieldName || "files", file);
        });
      } else {
        formData.append("file", files[0]);
      }

      const response = await fetch(
        `${API_BASE}${tool.endpoint}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let detail = `Request failed (${response.status}).`;

        try {
          const data = await response.json();
          detail = data.detail || data.message || detail;
        } catch {
          // The server may return a non-JSON error.
        }

        throw new Error(detail);
      }

      const blob = await response.blob();

      const disposition = response.headers.get(
        "content-disposition"
      );

      const match = disposition?.match(
        /filename="?([^";]+)"?/i
      );

      const filename = match?.[1] || tool.output;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

      setMessage(`Success! Download started: ${filename}`);
    } catch (err) {
      setError(true);
      setMessage(
        err.message ||
          "Could not process this file. Check your backend server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="document-tool-form"
      onSubmit={handleSubmit}
    >
      <label htmlFor="document-upload">
        {tool.multiple ? "Choose your files" : "Choose your file"}
      </label>

      <input
        id="document-upload"
        type="file"
        accept={tool.accept}
        multiple={Boolean(tool.multiple)}
        onChange={handleFileChange}
      />

      {files.length > 0 && (
        <div className="document-selected-files">
          {files.map((file, index) => (
            <p
              className="document-selected-file"
              key={`${file.name}-${file.size}-${index}`}
            >
              <span>📎</span> {file.name} ·{" "}
              {(file.size / 1024).toFixed(1)} KB
            </p>
          ))}
        </div>
      )}

      {tool.id === "translate-pdf" && (
        <p className="document-form-hint">
          Translation requires a target language. Your backend
          must provide a language selection field or default.
        </p>
      )}

      {tool.id === "redact-pdf" && (
        <p className="document-form-hint">
          Ensure the backend applies permanent redaction rather
          than simply drawing black boxes over the content.
        </p>
      )}

      <button
        className="document-submit-button"
        type="submit"
        disabled={loading}
      >
        {loading
          ? "Processing..."
          : `Start ${tool.title}`}
        {!loading && (
          <span aria-hidden="true"> →</span>
        )}
      </button>

      {message && (
        <p
          className={`document-tool-message ${
            error ? "error" : "success"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}