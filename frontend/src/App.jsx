import { useRef, useState } from "react";
import "./App.css";
import "./ImageCompressor.css";

import ImageCompressor from "./ImageCompressor";
import ImageToKBConverter from "./components/ImageToKBConverter";
import QRCodeGenerator from "./components/QRCodeGenerator";
import ResumeBuilder from "./ResumeBuilder";
import DocumentTools from "./components/DocumentTools";
import AdvancedPDFTools from "./components/AdvancedPDFTools";
import ProductivityTools from "./components/ProductivityTools";
import LocalStorage from "./components/LocalStorage";
import ReportMaker from "./components/ReportMaker";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const IMAGE_FORMATS = [
  "png",
  "jpg",
  "webp",
  "bmp",
  "gif",
  "tiff",
  "svg",
  "heic",
];

const SIZE_UNITS = {
  Bytes: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function KBConverter() {
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("KB");
  const [toUnit, setToUnit] = useState("MB");

  const number = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(number) &&
    number >= 0;

  const result = valid
    ? (number * SIZE_UNITS[fromUnit]) / SIZE_UNITS[toUnit]
    : null;

  const formattedResult =
    result === null
      ? ""
      : Number(result.toPrecision(10)).toLocaleString("en-US", {
          maximumFractionDigits: 10,
        });

  function swapUnits() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  }

  return (
    <div className="tool-content">
      <div className="section-heading">
        <p className="eyebrow">FILE SIZE UTILITY</p>
        <h2>KB Converter</h2>
        <p>Convert Bytes, KB, MB, GB, and TB instantly.</p>
      </div>

      <div className="settings-row">
        <label htmlFor="size-value">Enter file size</label>
        <input
          id="size-value"
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div className="settings-row">
        <label htmlFor="size-from">From unit</label>
        <select
          id="size-from"
          value={fromUnit}
          onChange={(event) => setFromUnit(event.target.value)}
        >
          {Object.keys(SIZE_UNITS).map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <label htmlFor="size-to">To unit</label>
        <select
          id="size-to"
          value={toUnit}
          onChange={(event) => setToUnit(event.target.value)}
        >
          {Object.keys(SIZE_UNITS).map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="browse-button"
        onClick={swapUnits}
      >
        Swap units ⇅
      </button>

      <div
        className={`message ${valid ? "success" : "error"}`}
        role="status"
      >
        {valid
          ? `${value} ${fromUnit} = ${formattedResult} ${toUnit}`
          : "Enter a valid non-negative number."}
      </div>

      <p className="privacy-note">
        Conversion happens in your browser. No file upload is required.
      </p>
    </div>
  );
}

function FileZenHome() {
  const [type, setType] = useState("image");
  const [pdfAction, setPdfAction] = useState("merge");
  const [wordAction, setWordAction] = useState("docx-to-txt");

  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState("png");
  const [pageNumber, setPageNumber] = useState("1");
  const [resizeWidth, setResizeWidth] = useState("800");
  const [resizeHeight, setResizeHeight] = useState("600");
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);

  const resetMessage = () => {
    setMessage("");
    setMessageType("");
  };

  const showMessage = (text, status = "success") => {
    setMessage(text);
    setMessageType(status);
  };

  const changeType = (newType) => {
    setType(newType);
    setFiles([]);
    resetMessage();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getAcceptTypes = () => {
    if (type === "image" || type === "image-resize") {
      return [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/bmp",
        "image/gif",
        "image/tiff",
        "image/svg+xml",
        "image/heic",
        "image/heif",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".bmp",
        ".gif",
        ".tif",
        ".tiff",
        ".svg",
        ".heic",
        ".heif",
      ].join(",");
    }

    if (type === "pdf") {
      return pdfAction === "image-to-pdf"
        ? "image/jpeg,image/png,.jpg,.jpeg,.png"
        : "application/pdf,.pdf";
    }

    if (type === "pdf-compress" || type === "pdf-to-word") {
      return "application/pdf,.pdf";
    }

    if (type === "word") {
      return wordAction === "docx-to-txt"
        ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ".txt,text/plain";
    }

    return "*/*";
  };

  const isMultipleAllowed = () =>
    type === "pdf" &&
    (pdfAction === "merge" || pdfAction === "image-to-pdf");

  const validateFile = (file) => {
    const name = (file.name || "").toLowerCase();

    if (type === "image" || type === "image-resize") {
      if (
        !/\.(png|jpe?g|webp|bmp|gif|tiff?|svg|heic|heif)$/i.test(name)
      ) {
        return "Choose a PNG, JPG, WEBP, BMP, GIF, TIFF, SVG, or HEIC image.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return "The image must be 20 MB or smaller.";
      }
    }

    if (
      ["pdf", "pdf-compress", "pdf-to-word"].includes(type) &&
      !(type === "pdf" && pdfAction === "image-to-pdf")
    ) {
      if (!name.endsWith(".pdf")) {
        return "Choose a PDF file.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return "The PDF must be 20 MB or smaller.";
      }
    }

    if (type === "pdf" && pdfAction === "image-to-pdf") {
      if (!/\.(jpg|jpeg|png)$/i.test(name)) {
        return "Choose JPG or PNG images for Image to PDF.";
      }

      if (file.size > 10 * 1024 * 1024) {
        return "Each image must be 10 MB or smaller.";
      }
    }

    if (type === "word" && wordAction === "docx-to-txt") {
      if (!name.endsWith(".docx")) {
        return "Choose a DOCX Word document.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return "The document must be 20 MB or smaller.";
      }
    }

    if (type === "word" && wordAction === "txt-to-docx") {
      if (!name.endsWith(".txt")) {
        return "Choose a TXT text file.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return "The text file must be 20 MB or smaller.";
      }
    }

    return null;
  };

  const addFiles = (incomingFiles) => {
    resetMessage();

    const incoming = Array.from(incomingFiles || []);
    if (incoming.length === 0) return;

    const multipleAllowed = isMultipleAllowed();

    if (!multipleAllowed && incoming.length > 1) {
      showMessage("Please select only one file.", "error");
      return;
    }

    const combined = multipleAllowed
      ? [...files, ...incoming]
      : incoming;

    const uniqueFiles = [];

    for (const file of combined) {
      const duplicate = uniqueFiles.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );

      if (!duplicate) uniqueFiles.push(file);
    }

    const maxFiles =
      type === "pdf" && pdfAction === "image-to-pdf" ? 20 : 10;

    if (uniqueFiles.length > maxFiles) {
      showMessage(`You can select a maximum of ${maxFiles} files.`, "error");
      return;
    }

    for (const file of uniqueFiles) {
      const error = validateFile(file);

      if (error) {
        showMessage(`${file.name}: ${error}`, "error");
        return;
      }
    }

    if (type === "pdf" && pdfAction === "image-to-pdf") {
      const totalSize = uniqueFiles.reduce(
        (total, file) => total + file.size,
        0
      );

      if (totalSize > 30 * 1024 * 1024) {
        showMessage("Total image size must be 30 MB or smaller.", "error");
        return;
      }
    }

    setFiles(uniqueFiles);
  };

  const handleFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removeFile = (indexToRemove) => {
    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    );
    resetMessage();
  };

  const clearFiles = () => {
    setFiles([]);
    resetMessage();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (file) => {
    const name = file.name.toLowerCase();

    if (name.endsWith(".pdf")) return "📕";
    if (name.endsWith(".docx")) return "📘";
    if (name.endsWith(".txt")) return "📄";

    return "🖼️";
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) {
      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    }

    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  };

  const getOutputFilename = (response, fallback) => {
    const disposition = response.headers.get("content-disposition");

    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match?.[1]) return match[1];
    }

    return fallback;
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        return data.detail;
      }

      if (Array.isArray(data.detail)) {
        return data.detail
          .map((item) => item.msg || "Invalid request")
          .join(", ");
      }

      return "The server could not process your files.";
    } catch {
      return `Request failed with status ${response.status}.`;
    }
  };

  const handleConvert = async () => {
    resetMessage();

    if (files.length === 0) {
      showMessage("Please upload a file first.", "error");
      return;
    }

    if (type === "pdf" && pdfAction === "merge" && files.length < 2) {
      showMessage("Upload at least two PDF files to merge.", "error");
      return;
    }

    const page = Number(pageNumber);

    if (
      type === "pdf" &&
      pdfAction === "split" &&
      (!Number.isInteger(page) || page < 1)
    ) {
      showMessage("Enter a valid page number starting from 1.", "error");
      return;
    }

    const width = Number(resizeWidth);
    const height = Number(resizeHeight);

    if (
      type === "image-resize" &&
      (!Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 10000 ||
        height > 10000)
    ) {
      showMessage(
        "Enter valid dimensions between 1 and 10000 pixels.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      let endpoint = "";
      let fallbackFilename = "filezen-output";

      if (type === "image") {
        formData.append("file", files[0]);
        endpoint = `${API_BASE}/api/convert/image/${format}`;
        fallbackFilename = `filezen-converted.${format}`;
      } else if (type === "pdf") {
        if (pdfAction === "merge") {
          files.forEach((file) => formData.append("files", file));
          endpoint = `${API_BASE}/api/pdf/merge`;
          fallbackFilename = "filezen-merged.pdf";
        } else if (pdfAction === "split") {
          formData.append("file", files[0]);
          endpoint = `${API_BASE}/api/pdf/split/${page}`;
          fallbackFilename = "filezen-page.pdf";
        } else {
          files.forEach((file) => formData.append("files", file));
          endpoint = `${API_BASE}/api/pdf/image-to-pdf`;
          fallbackFilename = "filezen-images.pdf";
        }
      } else if (type === "word") {
        formData.append("file", files[0]);

        if (wordAction === "docx-to-txt") {
          endpoint = `${API_BASE}/api/word/docx-to-txt`;
          fallbackFilename = "filezen-document.txt";
        } else {
          endpoint = `${API_BASE}/api/word/txt-to-docx`;
          fallbackFilename = "filezen-document.docx";
        }
      } else if (type === "pdf-compress") {
        formData.append("file", files[0]);
        endpoint = `${API_BASE}/api/pdf/compress`;
        fallbackFilename = "filezen-compressed.pdf";
      } else if (type === "image-resize") {
        formData.append("file", files[0]);
        formData.append("width", String(width));
        formData.append("height", String(height));
        formData.append("keep_aspect_ratio", String(keepAspectRatio));

        endpoint = `${API_BASE}/api/image/resize`;
        const extension = files[0].name.split(".").pop();
        fallbackFilename = `filezen-resized-${width}x${height}.${extension}`;
      } else if (type === "pdf-to-word") {
        formData.append("file", files[0]);
        endpoint = `${API_BASE}/api/pdf/to-word`;
        fallbackFilename = "filezen-converted.docx";
      }

      if (!endpoint) {
        throw new Error("This operation has no configured endpoint.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The server returned an empty file.");
      }

      const filename = getOutputFilename(response, fallbackFilename);
      downloadBlob(blob, filename);

      showMessage(`Success! Your file has been downloaded as ${filename}.`);
    } catch (error) {
      if (error instanceof TypeError) {
        showMessage(
          `Cannot connect to FileZen. Check that the backend is running at ${API_BASE}.`,
          "error"
        );
      } else {
        showMessage(
          error.message || "Something went wrong. Please try again.",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const getConvertLabel = () => {
    if (type === "image") return `Convert to ${format.toUpperCase()}`;

    if (type === "pdf") {
      if (pdfAction === "merge") return "Merge PDFs";
      if (pdfAction === "split") return "Extract Page";
      return "Convert Images to PDF";
    }

    if (type === "word") {
      return wordAction === "docx-to-txt"
        ? "Convert DOCX to TXT"
        : "Convert TXT to DOCX";
    }

    if (type === "pdf-compress") return "Compress PDF";
    if (type === "image-resize") return "Resize Image";
    if (type === "pdf-to-word") return "Convert PDF to Word";

    return "Process File";
  };

  const getUploadTitle = () => {
    if (type === "image") return "Upload your image";
    if (type === "pdf-compress") return "Upload a PDF to compress";
    if (type === "image-resize") return "Upload an image to resize";
    if (type === "pdf-to-word") return "Upload a PDF to convert";
    if (type === "pdf" && pdfAction === "merge") return "Upload PDF files";
    if (type === "pdf" && pdfAction === "split") return "Upload a PDF";
    if (type === "pdf") return "Upload your images";

    return wordAction === "docx-to-txt"
      ? "Upload a Word document"
      : "Upload a text file";
  };

  const getUploadHint = () => {
    if (type === "image" || type === "image-resize") {
      return "PNG, JPG, WEBP, BMP, GIF, TIFF, SVG or HEIC · Maximum 20 MB";
    }

    if (type === "pdf-compress" || type === "pdf-to-word") {
      return "PDF files only · Maximum 20 MB";
    }

    if (type === "pdf" && pdfAction === "merge") {
      return "Select at least 2 PDFs · Maximum 20 MB each";
    }

    if (type === "pdf" && pdfAction === "split") {
      return "PDF files only · Maximum 20 MB";
    }

    if (type === "pdf") {
      return "JPG or PNG · Maximum 10 MB each · Up to 20 images";
    }

    return wordAction === "docx-to-txt"
      ? "DOCX files only · Maximum 20 MB"
      : "TXT files only · Maximum 20 MB";
  };

  const tabs = [
    { id: "image", icon: "🖼️", label: "Image Converter" },
    { id: "image-kb", icon: "🎯", label: "Image to KB" },
    { id: "pdf", icon: "📑", label: "PDF Tools" },
    { id: "word", icon: "📝", label: "Word Converter" },
    { id: "size", icon: "📏", label: "KB Converter" },
    { id: "compress", icon: "🗜️", label: "Image Compressor" },
    { id: "pdf-compress", icon: "📉", label: "PDF Compressor" },
    { id: "image-resize", icon: "📐", label: "Image Resizer" },
    { id: "pdf-to-word", icon: "📃", label: "PDF to Word" },
  ];

  return (
    <div className="app">
      <header className="navbar">
        <a
          className="logo"
          href="#home"
          onClick={() => changeType("image")}
        >
          <span className="logo-icon">F</span>
          <span>FileZen</span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#tools">Tools</a>
          <a href="#advanced-pdf-tools">Advanced PDF Tools</a>
          <a href="#document-tools">Document Tools</a>
          <a href="#productivity-tools">More Ways to Work with Files</a>
          <a href="#cloud-storage">Cloud Storage</a>
          <a href="#qr-generator">QR Generator</a>
          <a href="/resume-builder">Resume Builder</a>
          <a href="/report-maker">Report Maker</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-badge">Simple tools. Better workflow.</div>

          <h1>
            Your files,
            <br />
            <span>your way.</span>
          </h1>

          <p>
            Convert images, manage PDFs, transform documents, resize and
            compress files, and calculate file sizes in one simple workspace.
          </p>

          <a className="hero-button" href="#tools">
            Explore tools <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section className="converter-section" id="tools">
          <div className="section-heading">
            <p className="eyebrow">FILE CONVERSION WORKSPACE</p>
            <h2>What would you like to do?</h2>
            <p>Choose a tool, upload your files, and get started.</p>
          </div>

          <div className="converter-card">
            <div className="tool-tabs" role="tablist" aria-label="File tools">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={type === tab.id}
                  className={`tool-tab ${type === tab.id ? "active" : ""}`}
                  onClick={() => changeType(tab.id)}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {type === "image-kb" ? (
              <div className="tool-content">
                <ImageToKBConverter />
              </div>
            ) : type === "size" ? (
              <KBConverter />
            ) : type === "compress" ? (
              <div className="tool-content">
                <ImageCompressor />
              </div>
            ) : (
              <div className="tool-content">
                {type === "image" && (
                  <div className="settings-row">
                    <label htmlFor="image-format">Output format</label>
                    <select
                      id="image-format"
                      value={format}
                      onChange={(event) => {
                        setFormat(event.target.value);
                        resetMessage();
                      }}
                    >
                      {IMAGE_FORMATS.map((item) => (
                        <option key={item} value={item}>
                          {item.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {type === "pdf" && (
                  <div className="settings-row">
                    <label htmlFor="pdf-action">PDF operation</label>
                    <select
                      id="pdf-action"
                      value={pdfAction}
                      onChange={(event) => {
                        setPdfAction(event.target.value);
                        setFiles([]);
                        resetMessage();
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <option value="merge">Merge PDFs</option>
                      <option value="split">Extract one page</option>
                      <option value="image-to-pdf">Image to PDF</option>
                    </select>
                  </div>
                )}

                {type === "pdf" && pdfAction === "split" && (
                  <div className="settings-row">
                    <label htmlFor="page-number">
                      Page number to extract
                    </label>
                    <input
                      id="page-number"
                      type="number"
                      min="1"
                      step="1"
                      value={pageNumber}
                      onChange={(event) => {
                        setPageNumber(event.target.value);
                        resetMessage();
                      }}
                    />
                  </div>
                )}

                {type === "word" && (
                  <div className="settings-row">
                    <label htmlFor="word-action">Conversion type</label>
                    <select
                      id="word-action"
                      value={wordAction}
                      onChange={(event) => {
                        setWordAction(event.target.value);
                        setFiles([]);
                        resetMessage();
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <option value="docx-to-txt">
                        Word (DOCX) to Text (TXT)
                      </option>
                      <option value="txt-to-docx">
                        Text (TXT) to Word (DOCX)
                      </option>
                    </select>
                  </div>
                )}

                {type === "image-resize" && (
                  <>
                    <div className="settings-row">
                      <label htmlFor="resize-width">Width (pixels)</label>
                      <input
                        id="resize-width"
                        type="number"
                        min="1"
                        max="10000"
                        value={resizeWidth}
                        onChange={(event) =>
                          setResizeWidth(event.target.value)
                        }
                      />
                    </div>

                    <div className="settings-row">
                      <label htmlFor="resize-height">Height (pixels)</label>
                      <input
                        id="resize-height"
                        type="number"
                        min="1"
                        max="10000"
                        value={resizeHeight}
                        onChange={(event) =>
                          setResizeHeight(event.target.value)
                        }
                      />
                    </div>

                    <div className="settings-row">
                      <label htmlFor="keep-aspect">
                        Preserve aspect ratio
                      </label>
                      <input
                        id="keep-aspect"
                        type="checkbox"
                        checked={keepAspectRatio}
                        onChange={(event) =>
                          setKeepAspectRatio(event.target.checked)
                        }
                      />
                    </div>
                  </>
                )}

                <div
                  className={`upload-area ${dragging ? "dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getAcceptTypes()}
                    multiple={isMultipleAllowed()}
                    className="file-input"
                    aria-label={getUploadTitle()}
                    onChange={handleFileChange}
                  />

                  <div className="upload-icon" aria-hidden="true">
                    {type === "image" || type === "image-resize"
                      ? "🖼️"
                      : type === "pdf-to-word"
                        ? "📃"
                        : type.startsWith("pdf")
                          ? "📂"
                          : "📄"}
                  </div>

                  <h3>{getUploadTitle()}</h3>

                  <p>
                    Drag and drop your files here, or{" "}
                    <button
                      type="button"
                      className="browse-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse files
                    </button>
                  </p>

                  <span className="upload-hint">{getUploadHint()}</span>
                </div>

                {files.length > 0 && (
                  <div className="selected-files">
                    <div className="selected-files-header">
                      <h3>Selected files ({files.length})</h3>
                      <button
                        type="button"
                        className="clear-files-button"
                        onClick={clearFiles}
                        disabled={loading}
                      >
                        Clear all
                      </button>
                    </div>

                    <ul className="file-list">
                      {files.map((file, index) => (
                        <li
                          className="file-item"
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        >
                          <span className="file-type-icon">
                            {getFileIcon(file)}
                          </span>

                          <span className="file-details">
                            <span className="file-name" title={file.name}>
                              {file.name}
                            </span>
                            <span className="file-size">
                              {formatSize(file.size)}
                            </span>
                          </span>

                          <button
                            type="button"
                            className="remove-file-button"
                            aria-label={`Remove ${file.name}`}
                            title="Remove file"
                            disabled={loading}
                            onClick={() => removeFile(index)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {message && (
                  <div
                    className={`message ${messageType}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span aria-hidden="true">
                      {messageType === "success" ? "✓" : "!"}
                    </span>{" "}
                    {message}
                  </div>
                )}

                <button
                  type="button"
                  className="convert-button"
                  disabled={loading || files.length === 0}
                  onClick={handleConvert}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Processing files...
                    </>
                  ) : (
                    <>
                      {getConvertLabel()}
                      <span aria-hidden="true"> →</span>
                    </>
                  )}
                </button>

                <p className="privacy-note">
                  Your files are processed by your FileZen backend. Avoid
                  uploading sensitive documents to a server you do not control.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="qr-generator" className="converter-section">
          <div className="section-heading">
            <p className="eyebrow">QUICK UTILITIES</p>
            <h2>QR Code Generator</h2>
            <p>Create a QR code for a link or text.</p>
          </div>
          <QRCodeGenerator />
        </section>

        <section className="features-section" id="about">
          <div className="section-heading">
            <p className="eyebrow">WHY FILEZEN?</p>
            <h2>Everything you need, in one place.</h2>
          </div>

          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Simple workflow</h3>
              <p>
                Upload your file, choose an operation, and download the result.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">🧰</div>
              <h3>Useful tools</h3>
              <p>
                Convert images, merge PDFs, convert documents, resize images,
                compress PDFs, and convert file sizes.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Responsive design</h3>
              <p>
                Use the same workspace on desktop, tablet, and mobile screens.
              </p>
            </article>
          </div>
        </section>

        <section id="advanced-pdf-tools">
          <AdvancedPDFTools />
        </section>

        <section id="document-tools">
          <DocumentTools />
        </section>

        <section id="productivity-tools">
          <ProductivityTools />
        </section>

        <section id="cloud-storage">
          <LocalStorage />
        </section>
      </main>

      <footer className="footer">
        <a className="logo footer-logo" href="#home">
          <span className="logo-icon">F</span>
          <span>FileZen</span>
        </a>

        <p>Simple tools for your everyday files.</p>
        <span>© {new Date().getFullYear()} FileZen</span>
      </footer>
    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/resume-builder") {
    return <ResumeBuilder />;
  }

  if (path === "/report-maker") {
    return <ReportMaker />;
  }

  return <FileZenHome />;
}

export default App;