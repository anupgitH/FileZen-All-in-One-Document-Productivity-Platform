import { useRef, useState } from "react";
import "./ImageToKBConverter.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const PRESETS = [50, 100, 200, 500];
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageToKBConverter() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [targetKB, setTargetKB] = useState("100");
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function selectFile(nextFile) {
    setError("");
    setResult(null);

    if (!nextFile) return;

    if (!/\.(jpe?g|png|webp)$/i.test(nextFile.name)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (nextFile.size > MAX_UPLOAD_SIZE) {
      setError("The maximum upload size is 20 MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);

    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function compressImage(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    const target = Number(targetKB);

    if (!file) {
      setError("Please select an image first.");
      return;
    }

    if (!Number.isInteger(target) || target < 1 || target > 10000) {
      setError("Enter a target size between 1 and 10000 KB.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_kb", String(target));

      const response = await fetch(`${API_BASE}/api/image/compress-to-kb`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Compression failed (${response.status}).`);
      }

      const blob = await response.blob();

      const originalSize =
        Number(response.headers.get("X-Original-Size")) || file.size;
      const compressedSize =
        Number(response.headers.get("X-Compressed-Size")) || blob.size;
      const percentSaved =
        Number(response.headers.get("X-Percent-Saved")) ||
        Math.max(0, ((originalSize - compressedSize) / originalSize) * 100);

      setResult({
        blob,
        originalSize,
        compressedSize,
        percentSaved,
        targetKB: target,
        filename: "compressed.jpg",
      });
    } catch (err) {
      setError(err.message || "Could not compress the image.");
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!result) return;

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);

    setFile(null);
    setPreview("");
    setResult(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="kb-tool">
      <div className="kb-heading">
        <p className="kb-eyebrow">IMAGE OPTIMIZER</p>
        <h2>Image to KB Converter</h2>
        <p>
          Compress JPG, PNG, and WebP images to a target file size.
        </p>
      </div>

      <form onSubmit={compressImage}>
        <div
          className="kb-upload"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

          {preview ? (
            <img className="kb-preview" src={preview} alt="Selected image" />
          ) : (
            <div className="kb-placeholder">
              <span>🖼️</span>
              <strong>Drop your image here</strong>
              <p>or choose a JPG, PNG, or WebP file</p>
            </div>
          )}

          {file && (
            <div className="kb-file-info">
              <strong>{file.name}</strong>
              <span>Original size: {formatSize(file.size)}</span>
            </div>
          )}

          <button
            type="button"
            className="kb-secondary"
            onClick={() => inputRef.current?.click()}
          >
            {file ? "Choose another image" : "Browse image"}
          </button>
        </div>

        <div className="kb-target">
          <label htmlFor="target-kb">Target size (KB)</label>
          <input
            id="target-kb"
            type="number"
            min="1"
            max="10000"
            step="1"
            value={targetKB}
            onChange={(event) => setTargetKB(event.target.value)}
          />

          <div className="kb-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={Number(targetKB) === preset ? "selected" : ""}
                onClick={() => setTargetKB(String(preset))}
              >
                {preset} KB
              </button>
            ))}
          </div>
        </div>

        {error && <p className="kb-error" role="alert">{error}</p>}

        <button className="kb-primary" type="submit" disabled={loading}>
          {loading ? "Compressing image..." : "Compress image"}
        </button>
      </form>

      {result && (
        <div className="kb-results">
          <h3>Compression results</h3>

          <div className="kb-stats">
            <div>
              <span>Original size</span>
              <strong>{formatSize(result.originalSize)}</strong>
            </div>
            <div>
              <span>Compressed size</span>
              <strong>{formatSize(result.compressedSize)}</strong>
            </div>
            <div>
              <span>Size saved</span>
              <strong>{result.percentSaved.toFixed(1)}%</strong>
            </div>
          </div>

          <p>
            {result.compressedSize <= result.targetKB * 1024
              ? `Target achieved: image is within ${result.targetKB} KB.`
              : `The image could not reach ${result.targetKB} KB. The smallest result produced is shown above.`}
          </p>

          <button
            type="button"
            className="kb-primary"
            onClick={downloadImage}
          >
            Download compressed JPG
          </button>
        </div>
      )}

      {file && (
        <button type="button" className="kb-clear" onClick={clearImage}>
          Clear image
        </button>
      )}

      <p className="kb-note">
        The output is JPEG, so transparent backgrounds are replaced with white.
        Very small target sizes may reduce image quality or dimensions.
      </p>
    </section>
  );
}