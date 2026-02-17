# Contributing to ResumeForge

Thank you for your interest in contributing to ResumeForge!

## Development Setup
1. Clone the repo.
2. Load the extension in Chrome via `chrome://extensions/` using "Load Unpacked".
3. Use the Chrome DevTools to debug the background service worker and popup.

## Guidelines
- **Maintain Honesty**: Any changes to the tailoring logic must adhere to the honesty guardrails defined in `shared/system-prompt-template.js`.
- **Modern UI**: Keep the UI clean, responsive, and supportive of dark mode.
- **Privacy**: Never add code that sends data to third-party servers other than Anthropic or the configured LaTeX compiler.

## Pull Request Process
1. Create a new branch for your feature.
2. Ensure the code is linted (ESLint).
3. Update the `README.md` if needed.
4. Submit a PR with a clear description of changes.

## License
By contributing, you agree that your contributions will be licensed under the MIT License.
