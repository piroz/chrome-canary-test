# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A chat UI for Chrome Canary's built-in Gemini Nano (on-device AI). Uses the Chrome Built-in AI Prompt API to run inference locally — no cloud backend, no build tools.

## Development

No build step. Serve the project root with any static server:

```
npx serve .
```

Then open in Chrome Canary with these flags enabled:
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement

No tests or linter configured.

## Architecture

Three files, no framework, no modules:

- **`index.html`** — Shell: chat message area, textarea + send button, setup guide (hidden by default)
- **`style.css`** — Dark theme, message bubbles (user right/blue, AI left/grey), fixed bottom input, typing indicator animation
- **`app.js`** — Single IIFE containing all logic:
  - **Init flow**: detects API via global `LanguageModel` (current) with fallback to `self.ai.languageModel` (legacy) → checks availability → creates session with system prompt → enables input
  - **Streaming**: uses `session.promptStreaming()` which yields delta text chunks (each chunk is new text, accumulated into `fullText` and assigned to the bubble)
  - **UI**: Enter sends, Shift+Enter for newline, auto-scroll, textarea auto-resize, typing indicator during generation

## Key API Details

- The Prompt API's `promptStreaming()` returns **delta** chunks (new text only, not the full response so far). Chunks must be accumulated manually.
- The API path changed from `self.ai.languageModel` to the global `LanguageModel` object. The code supports both with a fallback chain.
- Desktop only (Windows/macOS/Linux). Android Chrome Canary is not supported.
- Model download requires ~10GB free disk space.
