# ResumeForge — Chrome Extension for AI Resume Tailoring

**ResumeForge** is a production-ready Chrome extension that helps you tailor your resume for any job description in seconds. Using Claude Sonnet, it generates a high-quality, 1-page PDF resume and provides an honest fit assessment, highlighting your strengths and gaps.

## Features
- 🔨 **Instant Tailoring**: Select job description text, right-click, and forge.
- 📄 **LaTeX Quality**: Generates beautiful, professional 1-page PDFs.
- 🧐 **Honest Assessment**: Get a fit level (Strong/Moderate/Weak) and a breakdown of matched/missing skills.
- 🔄 **Iterative Feedback**: Don't like a bullet? Add feedback and regenerate.
- 🔒 **Privacy First**: Your data is stored locally in your browser. API calls go directly to Anthropic.

## Installation

### For Developers (Load Unpacked)
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `resumeforge` folder.

## Setup
1. Click the ResumeForge icon in your browser.
2. **Step 1: API Key** — Enter your Anthropic API key (starts with `sk-ant-`).
3. **Step 2: Master Resume** — Paste your master resume in the structured format (see below).
4. **Done!** You're ready to start forging.

## Master Resume Format
ResumeForge uses a specific structured format to parse your data bank safely.

```text
=== CONTACT ===
Name: John Doe
Email: john@example.com
...

=== EXPERIENCE ===
Company: Tech Corp | Title: Engineer | Location: NY | Start: Jan 2020 | End: Present
- Achievement bullet 1
- Achievement bullet 2
...

=== EDUCATION ===
Institution: University of Tech | Degree: MS | Field: CS | CGPA: 4.0/4.0 | Start: 2018 | End: 2020

=== SKILLS ===
Languages: Python, Go, SQL
Frameworks: PyTorch, React
...

=== TITLES I HAVE HELD ===
Software Engineer, Data Scientist
```

## Privacy & Security
- **Local Storage**: All your resume bullets and settings are stored in `chrome.storage.local`.
- **Direct API**: Data is sent only to `api.anthropic.com` and the LaTeX compiler. No intermediate servers are used.

## Technical Details: PDF Overflow Protection

Generating a LaTeX resume that fits exactly on one page via an API is challenging because the AI has no direct visual feedback. ResumeForge implements a two-stage protection system:

1.  **Strict Prompt Constraints**: The system prompt includes hard character limits for every section (e.g., bullets < 190 characters, summary < 350 characters) and a "line budget" of ~62 lines.
2.  **Automated Refinement**: If a generated PDF still exceeds one page, the background worker detects this by parsing the PDF binary. It then automatically sends the LaTeX back to Claude with specific trimming instructions. This process retries up to 2 times to ensure a perfect fit.

The `trimAttempts` field in your forge history shows if this automated refinement was triggered.

## Troubleshooting
- **API Errors**: Ensure your key is valid and has sufficient credits.
- **LaTeX Errors**: If the PDF fails to load, check the "Debug Info" in the popup to see the raw LaTeX source.
- **Parsing Errors**: Ensure you have the `=== SECTION NAME ===` headers exactly as shown.

## License
MIT
