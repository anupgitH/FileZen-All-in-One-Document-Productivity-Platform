import { useEffect, useState } from "react";
import "./ResumeBuilder.css";

const API_URL = "http://127.0.0.1:8000/api/resume/compile";

const DEFAULT_LATEX = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=1.5cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage{enumitem}
\usepackage{hyperref}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=1.2em, itemsep=2pt}

\begin{document}

\begin{center}
    {\LARGE \textbf{Your Name}}\\[4pt]
    Bengaluru, India\\
    \href{mailto:you@example.com}{you@example.com}
    \quad | \quad
    \href{https://github.com/yourusername}{GitHub}
\end{center}

\hrule
\vspace{8pt}

\section*{Education}
\textbf{Bachelor of Engineering in Computer Science}\\
Your University \hfill Expected Graduation: 2027

\section*{Technical Skills}
\textbf{Languages:} Java, Python, JavaScript, SQL\\
\textbf{Frameworks:} Spring Boot, React, FastAPI\\
\textbf{Tools:} Git, GitHub, PostgreSQL

\section*{Projects}
\textbf{FileZen -- File Management Platform}
\begin{itemize}
    \item Developed a file management application using React and FastAPI.
    \item Implemented file operations and a LaTeX resume compilation workflow.
\end{itemize}

\textbf{BudgetBuddy -- Expense Tracker}
\begin{itemize}
    \item Built a Python application to track expenses and store records in CSV.
\end{itemize}

\section*{Experience}
Add your internship or experience here.

\end{document}`;

export default function ResumeBuilder() {
  const [latex, setLatex] = useState(DEFAULT_LATEX);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function compileResume() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: latex }),
      });

      if (!response.ok) {
        let message = "Compilation failed.";

        try {
          const data = await response.json();
          message =
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail ?? data);
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (blob.type && !blob.type.includes("application/pdf")) {
        throw new Error("The server did not return a PDF file.");
      }

      const newUrl = URL.createObjectURL(blob);

      setPdfUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return newUrl;
      });

      setSuccess("Resume compiled successfully!");
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to FileZen API. Check whether FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadResume() {
    if (!pdfUrl) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "FileZen-Resume.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="resume-builder">
      <header className="resume-header">
        <div>
          <h1>FileZen Resume Builder</h1>
          <p>Write LaTeX, compile your resume, and export it as a PDF.</p>
        </div>

        <div className="resume-actions">
          <button
            className="compile-button"
            onClick={compileResume}
            disabled={loading}
          >
            {loading ? "Compiling..." : "Compile Resume"}
          </button>

          <button
            className="download-button"
            onClick={downloadResume}
            disabled={!pdfUrl || loading}
          >
            Download PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="resume-message error-message" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="resume-message success-message" role="status">
          {success}
        </div>
      )}

      <section className="resume-workspace">
        <div className="latex-panel">
          <div className="panel-heading">
            <h2>LaTeX Editor</h2>
            <span>{latex.length.toLocaleString()} characters</span>
          </div>

          <textarea
            className="latex-editor"
            value={latex}
            onChange={(event) => setLatex(event.target.value)}
            spellCheck={false}
            aria-label="LaTeX source editor"
            placeholder="Write your LaTeX resume here..."
          />
        </div>

        <div className="pdf-panel">
          <div className="panel-heading">
            <h2>PDF Preview</h2>
            <span>{pdfUrl ? "Compiled document" : "Not compiled yet"}</span>
          </div>

          {pdfUrl ? (
            <iframe
              className="pdf-preview"
              src={pdfUrl}
              title="Compiled resume PDF preview"
            />
          ) : (
            <div className="preview-placeholder">
              <h3>Your resume preview will appear here</h3>
              <p>
                Edit the LaTeX source and click Compile Resume to generate a PDF.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}