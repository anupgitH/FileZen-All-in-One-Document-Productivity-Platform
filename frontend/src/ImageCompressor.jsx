import { useEffect, useRef, useState } from "react";
import "./ImageCompressor.css";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ImageCompressor() {
  const [mode, setMode] = useState("compress");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [targetKB, setTargetKB] = useState("200");
  const [quality, setQuality] = useState(0.85);
  const [output, setOutput] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!output?.url) return;

    return () => URL.revokeObjectURL(output.url);
  }, [output]);

  const resetResult = () => {
    setOutput(null);
    setMessage("");
    setError(false);
  };

  const handleFile = (selectedFile) => {
    resetResult();

    if (!selectedFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/gif",
    ];

    const extensionAllowed = /\.(jpe?g|png|webp|bmp|gif)$/i.test(
      selectedFile.name
    );

    if (
      !allowedTypes.includes(selectedFile.type) &&
      !extensionAllowed
    ) {
      setFile(null);
      setMessage("Please select a JPG, PNG, WEBP, BMP, or GIF image.");
      setError(true);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setMessage("Please select an image smaller than 20 MB.");
      setError(true);
      return;
    }

    setFile(selectedFile);
  };

  const loadImage = (source) =>
    new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read this image."));

      image.src = source;
    });

  const canvasToBlob = (canvas, mimeType, imageQuality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Image conversion failed."));
        },
        mimeType,
        imageQuality
      );
    });

  const compressImage = async () => {
    if (!file) {
      setMessage("Please select an image first.");
      setError(true);
      return;
    }

    const target = Number(targetKB);

    if (
      !Number.isFinite(target) ||
      target <= 0 ||
      target > 20000
    ) {
      setMessage("Enter a target size between 1 and 20000 KB.");
      setError(true);
      return;
    }

    setProcessing(true);
    resetResult();

    try {
      const sourceURL = URL.createObjectURL(file);

      try {
        const image = await loadImage(sourceURL);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Your browser could not create an image canvas.");
        }

        let width = image.naturalWidth;
        let height = image.naturalHeight;

        const maxDimension = 5000;

        if (Math.max(width, height) > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const targetBytes = target * 1024;
        let bestBlob = null;
        let bestWidth = width;
        let bestHeight = height;

        // Try progressively smaller dimensions and image quality.
        for (let scale = 1; scale >= 0.15; scale *= 0.8) {
          const currentWidth = Math.max(1, Math.round(width * scale));
          const currentHeight = Math.max(1, Math.round(height * scale));

          canvas.width = currentWidth;
          canvas.height = currentHeight;

          context.clearRect(0, 0, currentWidth, currentHeight);
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, currentWidth, currentHeight);
          context.drawImage(
            image,
            0,
            0,
            currentWidth,
            currentHeight
          );

          for (
            let currentQuality = quality;
            currentQuality >= 0.1;
            currentQuality -= 0.1
          ) {
            const blob = await canvasToBlob(
              canvas,
              "image/jpeg",
              Math.max(0.1, currentQuality)
            );

            if (!bestBlob || blob.size < bestBlob.size) {
              bestBlob = blob;
              bestWidth = currentWidth;
              bestHeight = currentHeight;
            }

            if (blob.size <= targetBytes) {
              bestBlob = blob;
              bestWidth = currentWidth;
              bestHeight = currentHeight;
              break;
            }
          }

          if (bestBlob && bestBlob.size <= targetBytes) break;
        }

        if (!bestBlob) {
          throw new Error("Unable to compress this image.");
        }

        const resultURL = URL.createObjectURL(bestBlob);

        setOutput({
          blob: bestBlob,
          url: resultURL,
          filename: `${file.name.replace(/\.[^.]+$/, "")}-compressed.jpg`,
          width: bestWidth,
          height: bestHeight,
        });

        if (bestBlob.size <= targetBytes) {
          setMessage(
            `Compression complete! Output size: ${formatBytes(bestBlob.size)}.`
          );
          setError(false);
        } else {
          setMessage(
            `The image could not reach ${target} KB. The smallest result found is ${formatBytes(bestBlob.size)}. Try a larger target size.`
          );
          setError(true);
        }
      } finally {
        URL.revokeObjectURL(sourceURL);
      }
    } catch (err) {
      setMessage(err.message || "Something went wrong during compression.");
      setError(true);
    } finally {
      setProcessing(false);
    }
  };

  const checkImageSize = () => {
    if (!file) {
      setMessage("Please select an image first.");
      setError(true);
      return;
    }

    setMessage(
      `Original file size: ${formatBytes(file.size)} (${(file.size / 1024).toFixed(2)} KB). Dimensions are shown in the preview below.`
    );
    setError(false);
  };

  const downloadImage = () => {
    if (!output) return;

    const link = document.createElement("a");
    link.href = output.url;
    link.download = output.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const clearImage = () => {
    setFile(null);
    setOutput(null);
    setMessage("");
    setError(false);

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="image-compressor">
      <div className="compressor-heading">
        <p className="compressor-eyebrow">IMAGE TOOLS</p>
        <h2>Image Compressor &amp; Size Checker</h2>
        <p>
          Compress images to a target size or inspect the original file size.
        </p>
      </div>

      <div className="compressor-tabs">
        <button
          type="button"
          className={mode === "compress" ? "active" : ""}
          onClick={() => {
            setMode("compress");
            resetResult();
          }}
        >
          Compress to KB
        </button>

        <button
          type="button"
          className={mode === "check" ? "active" : ""}
          onClick={() => {
            setMode("check");
            resetResult();
          }}
        >
          Check image size
        </button>
      </div>

      <label
        className="compressor-upload"
        htmlFor="compressor-file"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        <span className="compressor-upload-icon">↑</span>
        <strong>{file ? "Change image" : "Select an image"}</strong>
        <span>
          {file
            ? file.name
            : "Drag and drop your image here, or click to browse"}
        </span>
        <small>JPG, PNG, or WebP · Maximum 20 MB</small>

        <input
          ref={inputRef}
          id="compressor-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </label>

      {file && (
        <div className="compressor-file-info">
          <div>
            <span>Original file</span>
            <strong>{file.name}</strong>
          </div>
          <div>
            <span>Original size</span>
            <strong>{formatBytes(file.size)}</strong>
          </div>
          <button
            type="button"
            className="compressor-clear"
            onClick={clearImage}
          >
            Remove
          </button>
        </div>
      )}

      {mode === "compress" && (
        <div className="compressor-settings">
          <label htmlFor="compressor-target">Target size (KB)</label>
          <input
            id="compressor-target"
            type="number"
            min="1"
            max="20000"
            value={targetKB}
            onChange={(event) => setTargetKB(event.target.value)}
          />

          <label htmlFor="compressor-quality">
            Starting quality: {Math.round(quality * 100)}%
          </label>
          <input
            id="compressor-quality"
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />

          <p>
            The compressor adjusts JPEG quality and dimensions to try to meet
            your target. The output image is JPEG.
          </p>
        </div>
      )}

      {file && (
        <div className="compressor-preview">
          <div className="compressor-preview-card">
            <h3>Original image</h3>
            <img src={preview} alt="Original upload preview" />
            <p>{formatBytes(file.size)}</p>
          </div>

          {output && (
            <div className="compressor-preview-card">
              <h3>Compressed image</h3>
              <img src={output.url} alt="Compressed result preview" />
              <p>
                {formatBytes(output.blob.size)} · {output.width} ×{" "}
                {output.height}px
              </p>
              <p>
                {file.size > 0
                  ? `${Math.max(
                      0,
                      (1 - output.blob.size / file.size) * 100
                    ).toFixed(1)}% smaller`
                  : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`compressor-message ${error ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {mode === "compress" ? (
        <button
          type="button"
          className="compressor-primary-button"
          disabled={!file || processing}
          onClick={compressImage}
        >
          {processing ? "Compressing image..." : "Compress Image"}
        </button>
      ) : (
        <button
          type="button"
          className="compressor-primary-button"
          disabled={!file}
          onClick={checkImageSize}
        >
          Check Image Size
        </button>
      )}

      {output && (
        <button
          type="button"
          className="compressor-download-button"
          onClick={downloadImage}
        >
          Download Compressed Image
        </button>
      )}

      <p className="compressor-privacy">
        Image processing happens locally in your browser. Your image is not
        uploaded to a conversion server by this component.
      </p>
    </div>
  );
}

export default ImageCompressor;