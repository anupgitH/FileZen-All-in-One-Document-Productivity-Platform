import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeGenerator() {
  const [text, setText] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [size, setSize] = useState(300);
  const [darkColor, setDarkColor] = useState("#17172b");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef(null);

  async function generateQRCode(event) {
    if (event) event.preventDefault();

    const content = text.trim();

    if (!content) {
      setError("Please enter text or a URL first.");
      setQrImage("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const canvas = canvasRef.current;

      await QRCode.toCanvas(canvas, content, {
        width: Number(size),
        margin: 3,
        errorCorrectionLevel: "H",
        color: {
          dark: darkColor,
          light: lightColor,
        },
      });

      setQrImage(canvas.toDataURL("image/png"));
    } catch (err) {
      console.error("QR code generation failed:", err);
      setError("Unable to generate the QR code. Please try again.");
      setQrImage("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!text.trim()) {
      setQrImage("");
      setError("");
      return;
    }

    generateQRCode();
    // Regenerate when appearance settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, darkColor, lightColor]);

  function downloadQRCode() {
    if (!qrImage) return;

    const link = document.createElement("a");
    link.href = qrImage;
    link.download = "filezen-qr-code.png";

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function clearQRCode() {
    setText("");
    setQrImage("");
    setError("");
  }

  return (
    <section className="qr-generator" id="qr-generator">
      <div className="qr-generator__header">
        <div>
          <p className="eyebrow">QUICK TOOL</p>
          <h2>QR Code Generator</h2>
          <p>
            Create and download QR codes for website links, text, email
            addresses, and more.
          </p>
        </div>
      </div>

      <form className="qr-generator__form" onSubmit={generateQRCode}>
        <label htmlFor="qr-content">Text or URL</label>

        <textarea
          id="qr-content"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setQrImage("");
            setError("");
          }}
          placeholder="https://example.com"
          rows={4}
          maxLength={4000}
        />

        <div className="qr-generator__settings">
          <div>
            <label htmlFor="qr-size">Image size</label>
            <select
              id="qr-size"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            >
              <option value={200}>200 × 200</option>
              <option value={300}>300 × 300</option>
              <option value={500}>500 × 500</option>
              <option value={800}>800 × 800</option>
            </select>
          </div>

          <div>
            <label htmlFor="qr-dark">QR color</label>
            <input
              id="qr-dark"
              type="color"
              value={darkColor}
              onChange={(event) => setDarkColor(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="qr-light">Background</label>
            <input
              id="qr-light"
              type="color"
              value={lightColor}
              onChange={(event) => setLightColor(event.target.value)}
            />
          </div>
        </div>

        <div className="qr-generator__actions">
          <button type="submit" disabled={loading || !text.trim()}>
            {loading ? "Generating..." : "Generate QR Code"}
          </button>

          <button
            type="button"
            className="qr-generator__secondary"
            onClick={clearQRCode}
          >
            Clear
          </button>
        </div>
      </form>

      {error && (
        <p className="qr-generator__error" role="alert">
          {error}
        </p>
      )}

      <div className="qr-generator__preview">
        {qrImage ? (
          <>
            <img src={qrImage} alt="Generated QR code" />

            <p>Scan this QR code using your phone camera.</p>

            <button type="button" onClick={downloadQRCode}>
              Download PNG
            </button>
          </>
        ) : (
          <div className="qr-generator__empty">
            <span aria-hidden="true">▦</span>
            <p>Your QR code will appear here.</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="qr-generator__canvas"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}