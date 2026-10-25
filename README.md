# FileZen — All-in-One Document Productivity Platform

<p align="center">
  <strong>One platform. All your document needs.</strong>
</p>

<p align="center">
  A full-stack productivity platform for PDF utilities, document conversion, AI-powered PDF assistance, and file management.
</p>

<p align="center">
  <a href="https://github.com/anupgitH/FileZen-All-in-One-Document-Productivity-Platform">GitHub Repository</a>
</p>

---

## Overview

**FileZen** is an all-in-one document productivity platform designed to simplify common file and document workflows in one place. It combines a React frontend with a FastAPI backend to provide a unified interface for document processing and productivity tools.

## Features

- **PDF Tools** — Utilities for working with PDF documents.
- **File Conversion** — Convert supported file formats.
- **AI PDF Chat** — Ask questions about an uploaded PDF using the Google Gemini API.
- **Document Management** — Access document-related tools from one interface.
- **Resume Builder** — Create and manage resumes.
- **QR Code Generation** — Generate QR codes.
- **Image Compression** — Reduce image file sizes.
- **Report Generation** — Create reports using available report tools.
- **Web Interface** — React-based frontend with a FastAPI backend.

*Feature availability depends on the corresponding implementation and configuration.*

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, FastAPI, Uvicorn |
| AI Integration | Google Gemini API |
| Document Processing | PyMuPDF, pypdf, python-docx |
| Image Processing | Pillow, pillow-heif |
| API Testing | FastAPI Swagger UI |
| Version Control | Git, GitHub |

## Architecture

```text
User
  |
  v
React + Vite Frontend
  |
  | HTTP / REST API
  v
FastAPI Backend
  |
  +--> PDF and Document Tools
  +--> File Conversion
  +--> Image Processing
  +--> Resume and Report Tools
  +--> Google Gemini API
```

## Getting Started

### Prerequisites

Install the following before running FileZen locally:

- Python 3.11 or later
- Node.js and npm
- Git
- A Google Gemini API key for AI PDF chat

### 1. Clone the repository

```bash
git clone https://github.com/anupgitH/FileZen-All-in-One-Document-Productivity-Platform.git
cd FileZen-All-in-One-Document-Productivity-Platform
```

### 2. Configure the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**macOS / Linux**

```bash
source .venv/bin/activate
```

**Windows**

```powershell
.venv\Scripts\activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Create a `backend/.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
```

Replace the placeholder with your own API key. Never commit `.env` or expose your API key publicly.

Start the backend:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Backend API: `http://127.0.0.1:8000`

Interactive API documentation: `http://127.0.0.1:8000/docs`

### 3. Configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 4. Connect the frontend to the backend

Configure the frontend API base URL to point to the backend.

For local development, use:

```text
http://127.0.0.1:8000
```

For deployment, use your actual hosted backend URL. Ensure the backend CORS configuration allows your frontend origin.

## AI PDF Chat

FileZen's AI PDF chat uses the Google Gemini API to answer questions about uploaded PDF documents.

1. Start the backend and frontend.
2. Open the AI PDF Chat feature.
3. Upload a PDF and enter a question.
4. Submit the request and review the response.

AI functionality requires a valid API key, an available model, and network access. Model availability and API limits may vary.

## Deployment

### Frontend

The React frontend can be built for static hosting:

```bash
cd frontend
npm run build
```

The production build is generated in `frontend/dist`.

GitHub Pages deployment guide: [Vite Static Deployment](https://vite.dev/guide/static-deploy.html)

### Backend

The FastAPI backend can be deployed to a Python-compatible hosting service such as Render.

Example start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Configure required environment variables in your hosting provider's dashboard. Do not upload your local `.env` file.

**Important:** Static hosting only serves the frontend. PDF processing, AI requests, and other backend-dependent features require the backend to be deployed and correctly configured.

## Security

- Never commit API keys, passwords, tokens, or `.env` files.
- Keep secrets in environment variables.
- Validate uploaded files and enforce file-size limits.
- Restrict CORS to trusted frontend origins in production.
- Rotate any credential accidentally exposed in a repository.

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your changes locally.
5. Submit a pull request describing your improvements.

For bugs or feature requests, open an issue in the [GitHub repository](https://github.com/anupgitH/FileZen-All-in-One-Document-Productivity-Platform/issues).

## Roadmap

Potential future improvements include:

- Additional document and file conversion formats
- Improved PDF processing workflows
- More robust AI document interactions
- Enhanced accessibility and responsive design
- Automated testing and deployment
- Better error handling and upload progress indicators

## License

No license has been specified yet. Add a `LICENSE` file before distributing the project under an open-source license.

---

<p align="center">
  Built with React, FastAPI, and Python.
</p>
