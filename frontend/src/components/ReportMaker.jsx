import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const initialForm = {
  title: "",
  author: "",
  organization: "",
  report_type: "Project Report",
  abstract: "",
  introduction: "",
  objectives: "",
  methodology: "",
  results: "",
  conclusion: "",
};

const fields = [
  ["abstract", "Abstract"],
  ["introduction", "Introduction"],
  ["objectives", "Objectives"],
  ["methodology", "Methodology"],
  ["results", "Results and Discussion"],
  ["conclusion", "Conclusion"],
];

export default function ReportMaker() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function generateReport(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/api/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Keep the fallback message if the response isn't JSON.
        }

        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/pdf")) {
        throw new Error("The server did not return a PDF file.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "filezen-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("Report generated and downloaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate the report."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="report-maker">
      <header className="report-header">
        <h1>Report Maker</h1>
        <p>Create a professional report and download it as a PDF.</p>
      </header>

      <form onSubmit={generateReport} className="report-form">
        <section className="report-section">
          <h2>Report Details</h2>

          <label>
            Report Title *
            <input
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="Enter your report title"
              maxLength={200}
              required
            />
          </label>

          <div className="report-row">
            <label>
              Author
              <input
                name="author"
                value={form.author}
                onChange={updateField}
                placeholder="Your name"
                maxLength={100}
              />
            </label>

            <label>
              Organization
              <input
                name="organization"
                value={form.organization}
                onChange={updateField}
                placeholder="College or company"
                maxLength={200}
              />
            </label>
          </div>

          <label>
            Report Type
            <select
              name="report_type"
              value={form.report_type}
              onChange={updateField}
            >
              <option>Project Report</option>
              <option>College Report</option>
              <option>Internship Report</option>
              <option>Business Report</option>
              <option>Research Report</option>
              <option>Technical Report</option>
            </select>
          </label>
        </section>

        <section className="report-section">
          <h2>Report Content</h2>

          {fields.map(([name, label]) => (
            <label key={name}>
              {label}
              <textarea
                name={name}
                value={form[name]}
                onChange={updateField}
                placeholder={`Write your ${label.toLowerCase()}...`}
                rows={4}
                maxLength={
                  name === "abstract" || name === "objectives"
                    ? 5000
                    : 10000
                }
              />
            </label>
          ))}
        </section>

        {error && (
          <p className="report-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="report-success" role="status">
            {success}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Generating PDF..." : "Generate and Download PDF"}
        </button>
      </form>

      <style>{`
        .report-maker {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px 20px;
          color: #1f2937;
          font-family: Arial, sans-serif;
        }

        .report-header {
          margin-bottom: 28px;
        }

        .report-header h1 {
          margin-bottom: 8px;
          font-size: 32px;
        }

        .report-header p {
          color: #64748b;
        }

        .report-form {
          display: grid;
          gap: 24px;
        }

        .report-section {
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          display: grid;
          gap: 18px;
        }

        .report-section h2 {
          margin: 0;
          font-size: 20px;
        }

        .report-form label {
          display: grid;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .report-form input,
        .report-form select,
        .report-form textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font: inherit;
          font-weight: 400;
          background: white;
          color: #1f2937;
        }

        .report-form textarea {
          resize: vertical;
          line-height: 1.5;
        }

        .report-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .report-form button {
          border: none;
          border-radius: 8px;
          padding: 14px 20px;
          background: #2563eb;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .report-form button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .report-error {
          color: #b91c1c;
          white-space: pre-wrap;
        }

        .report-success {
          color: #15803d;
        }

        @media (max-width: 600px) {
          .report-row {
            grid-template-columns: 1fr;
          }

          .report-section {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}