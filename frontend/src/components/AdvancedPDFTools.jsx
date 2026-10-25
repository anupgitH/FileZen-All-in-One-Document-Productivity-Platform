
import { useRef, useState } from "react";
import "./AdvancedPDFTools.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const TOOLS = [
  { id: "to-jpg", name: "PDF to JPG", icon: "🖼️", description: "Convert every PDF page into JPG images." },
  { id: "from-jpg", name: "JPG to PDF", icon: "📄", description: "Combine JPG images into one PDF." },
  { id: "sign", name: "Sign PDF", icon: "✍️", description: "Place a signature image on a PDF page." },
  { id: "watermark", name: "Watermark PDF", icon: "💧", description: "Add a text watermark to every page." },
  { id: "rotate", name: "Rotate PDF", icon: "🔄", description: "Rotate selected pages." },
  { id: "html-to-pdf", name: "HTML to PDF", icon: "🌐", description: "Turn HTML content into a PDF." },
  { id: "unlock", name: "Unlock PDF", icon: "🔓", description: "Remove encryption using the correct password." },
  { id: "protect", name: "Protect PDF", icon: "🔐", description: "Encrypt your PDF with a password." },
  { id: "organize", name: "Organize PDF", icon: "📚", description: "Reorder, extract, or remove pages." },
  { id: "repair", name: "Repair PDF", icon: "🛠️", description: "Attempt to recover a damaged PDF." },
];

const INITIAL_OPTIONS = {
  dpi: "150",
  page_number: "1",
  x: "350",
  y: "650",
  width: "150",
  height: "60",
  text: "CONFIDENTIAL",
  opacity: "0.25",
  font_size: "40",
  angle: "90",
  page_numbers: "all",
  password: "",
  page_order: "",
  html_content: "<!doctype html><html><body><h1>Hello from FileZen</h1><p>Your PDF starts here.</p></body></html>",
};

function Field({ label, children }) {
  return (
    <label className="advanced-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AdvancedPDFTools() {
  const [selectedTool, setSelectedTool] = useState("to-jpg");
  const [file, setFile] = useState(null);
  const [signature, setSignature] = useState(null);
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const tool = TOOLS.find((item) => item.id === selectedTool);

  function updateOption(name, value) {
    setOptions((previous) => ({ ...previous, [name]: value }));
  }

  function selectTool(id) {
    setSelectedTool(id);
    setFile(null);
    setSignature(null);
    setError("");
    setMessage("");
    setOptions(INITIAL_OPTIONS);
  }

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError("");
    setMessage("");
  }

  function appendFile(formData) {
    if (file) formData.append("file", file);
  }

  function validate() {
    if (selectedTool === "html-to-pdf") {
      if (!options.html_content.trim()) {
        setError("Enter some HTML content first.");
        return false;
      }
      return true;
    }

    if (selectedTool === "from-jpg") {
      if (!file) {
        setError("Choose a JPG image. To combine multiple images, use the multi-image selector.");
        return false;
      }
      return true;
    }

    if (!file) {
      setError("Please choose a file first.");
      return false;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Maximum upload size is 50 MB.");
      return false;
    }

    if (selectedTool === "sign" && !signature) {
      setError("Choose your signature image.");
      return false;
    }

    if (selectedTool === "unlock" && !options.password) {
      setError("Enter the PDF password.");
      return false;
    }

    if (selectedTool === "protect" && options.password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return false;
    }

    if (selectedTool === "organize" && !options.page_order.trim()) {
      setError("Enter page order, for example [3,1,2].");
      return false;
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!validate()) return;

    setBusy(true);

    try {
      const formData = new FormData();

      if (selectedTool === "html-to-pdf") {
        formData.append("html_content", options.html_content);
      } else if (selectedTool === "from-jpg") {
        formData.append("files", file);
      } else {
        appendFile(formData);
      }

      const fieldsByTool = {
        "to-jpg": ["dpi"],
        sign: ["page_number", "x", "y", "width", "height"],
        watermark: ["text", "opacity", "font_size"],
        rotate: ["angle", "page_numbers"],
        unlock: ["password"],
        protect: ["password"],
        organize: ["page_order"],
      };

      for (const field of fieldsByTool[selectedTool] || []) {
        formData.append(field, options[field]);
      }

      if (
        ["to-jpg", "sign", "watermark", "rotate", "organize"].includes(
          selectedTool
        )
      ) {
        formData.append("password", options.password);
      }

      if (selectedTool === "sign") {
        formData.append("signature", signature);
      }

      const response = await fetch(
        `${API_BASE}/api/pdf/${selectedTool}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let detail = "The operation failed.";
        try {
          const body = await response.json();
          detail = body.detail || detail;
        } catch {
          // Response was not JSON.
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = {
        "to-jpg": "pdf-images.zip",
        "from-jpg": "images.pdf",
        sign: "signed.pdf",
        watermark: "watermarked.pdf",
        rotate: "rotated.pdf",
        "html-to-pdf": "html-document.pdf",
        unlock: "unlocked.pdf",
        protect: "protected.pdf",
        organize: "organized.pdf",
        repair: "repaired.pdf",
      }[selectedTool];

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage("Your file has been generated and the download has started.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function renderOptions() {
    switch (selectedTool) {
      case "to-jpg":
        return (
          <Field label="Image quality (DPI)">
            <select value={options.dpi} onChange={(e) => updateOption("dpi", e.target.value)}>
              <option value="100">100 DPI — Smaller files</option>
              <option value="150">150 DPI — Recommended</option>
              <option value="200">200 DPI — High quality</option>
              <option value="300">300 DPI — Print quality</option>
            </select>
          </Field>
        );

      case "sign":
        return (
          <>
            <Field label="Signature image">
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setSignature(e.target.files?.[0] || null)}
              />
            </Field>
            {signature && <p className="advanced-hint">Signature: {signature.name}</p>}
            <div className="advanced-grid">
              <Field label="Page number">
                <input type="number" min="1" value={options.page_number} onChange={(e) => updateOption("page_number", e.target.value)} />
              </Field>
              <Field label="Width (points)">
                <input type="number" min="1" value={options.width} onChange={(e) => updateOption("width", e.target.value)} />
              </Field>
              <Field label="X position">
                <input type="number" value={options.x} onChange={(e) => updateOption("x", e.target.value)} />
              </Field>
              <Field label="Y position">
                <input type="number" value={options.y} onChange={(e) => updateOption("y", e.target.value)} />
              </Field>
              <Field label="Height (points)">
                <input type="number" min="1" value={options.height} onChange={(e) => updateOption("height", e.target.value)} />
              </Field>
            </div>
            <p className="advanced-hint">Coordinates use PDF points measured from the top-left. Preview the result before sharing.</p>
          </>
        );

      case "watermark":
        return (
          <div className="advanced-grid">
            <Field label="Watermark text">
              <input value={options.text} maxLength={120} onChange={(e) => updateOption("text", e.target.value)} />
            </Field>
            <Field label="Font size">
              <input type="number" min="8" max="100" value={options.font_size} onChange={(e) => updateOption("font_size", e.target.value)} />
            </Field>
            <Field label="Opacity (0.05–1)">
              <input type="number" min="0.05" max="1" step="0.05" value={options.opacity} onChange={(e) => updateOption("opacity", e.target.value)} />
            </Field>
          </div>
        );

      case "rotate":
        return (
          <>
            <Field label="Rotation angle">
              <select value={options.angle} onChange={(e) => updateOption("angle", e.target.value)}>
                <option value="90">90° clockwise</option>
                <option value="180">180°</option>
                <option value="270">270° clockwise</option>
              </select>
            </Field>
            <Field label="Pages to rotate">
              <input value={options.page_numbers} onChange={(e) => updateOption("page_numbers", e.target.value)} placeholder="all or 1,3,5" />
            </Field>
          </>
        );

      case "html-to-pdf":
        return (
          <Field label="HTML content">
            <textarea
              rows="10"
              value={options.html_content}
              onChange={(e) => updateOption("html_content", e.target.value)}
              placeholder="Paste HTML here..."
            />
          </Field>
        );

      case "unlock":
        return (
          <Field label="Current PDF password">
            <input type="password" autoComplete="current-password" value={options.password} onChange={(e) => updateOption("password", e.target.value)} />
          </Field>
        );

      case "protect":
        return (
          <Field label="New PDF password (minimum 6 characters)">
            <input type="password" autoComplete="new-password" value={options.password} onChange={(e) => updateOption("password", e.target.value)} />
          </Field>
        );

      case "organize":
        return (
          <Field label="New page order">
            <input value={options.page_order} onChange={(e) => updateOption("page_order", e.target.value)} placeholder="[3,1,2]" />
            <small>Use original page numbers in a JSON array. For example, [3,1,2] reorders a 3-page PDF.</small>
          </Field>
        );

      case "from-jpg":
        return (
          <p className="advanced-hint">Select a JPG image to convert. For multiple images, change the file input to allow multiple selections and append each file to the request.</p>
        );

      case "repair":
        return (
          <p className="advanced-hint">Repair is best-effort. Severely damaged files may not be recoverable.</p>
        );

      default:
        return null;
    }
  }

  const expectsPdf = selectedTool !== "from-jpg" && selectedTool !== "html-to-pdf";

  return (
    <section className="advanced-pdf-section" id="advanced-pdf-tools">
      <div className="advanced-heading">
        <span className="advanced-eyebrow">MORE POWERFUL TOOLS</span>
        <h2>Advanced PDF Tools</h2>
        <p>Convert, secure, organize, and edit your documents in one place.</p>
      </div>

      <div className="advanced-tool-grid">
        {TOOLS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`advanced-tool-card ${selectedTool === item.id ? "selected" : ""}`}
            onClick={() => selectTool(item.id)}
          >
            <span className="advanced-tool-icon">{item.icon}</span>
            <strong>{item.name}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      <form className="advanced-workspace" onSubmit={handleSubmit}>
        <div className="advanced-workspace-heading">
          <span className="advanced-tool-icon">{tool.icon}</span>
          <div>
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
          </div>
        </div>

        {selectedTool !== "html-to-pdf" && (
          <div className="advanced-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept={selectedTool === "from-jpg" ? "image/jpeg,image/jpg" : ".pdf,application/pdf"}
              onChange={handleFileChange}
              hidden
            />

            <span className="advanced-upload-icon">
              {file ? "📎" : expectsPdf ? "📄" : "🖼️"}
            </span>

            <strong>
              {file ? file.name : expectsPdf ? "Choose your PDF file" : "Choose a JPG image"}
            </strong>

            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                : "Maximum file size: 50 MB"}
            </span>

            <button
              type="button"
              className="advanced-browse-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse files
            </button>
          </div>
        )}

        <div className="advanced-options">{renderOptions()}</div>

        {error && <div className="advanced-alert error" role="alert">{error}</div>}
        {message && <div className="advanced-alert success" role="status">{message}</div>}

        <button className="advanced-submit" type="submit" disabled={busy}>
          {busy ? "Processing..." : `Process ${tool.name}`}
        </button>

        <p className="advanced-privacy">
          Only upload documents you are authorized to process. Review downloaded files before sharing.
        </p>
      </form>
    </section>
  );
}
