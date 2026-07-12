<div align="center">

  <img src="assets/fillwright-logo.png" alt="Fillwright Logo" width="200" />

  <h1 style="color:#1B2A4A; font-family:Georgia,serif; border-bottom:3px solid #C5A55A; padding-bottom:8px; display:inline-block;">Fillwright</h1>

  <p style="color:#666666; font-size:16px; margin-top:8px;">
    <strong>Local-first, multi-step form autofiller powered by Gemini Nano</strong>
  </p>

  <p style="color:#666666; font-size:14px;">
    Privacy-first. On-device AI. No field data ever leaves your browser.
  </p>

  <br />

  <a href="#quick-start">
    <img src="https://img.shields.io/badge/GET%20STARTED-1B2A4A?style=for-the-badge&color=1B2A4A&labelColor=1B2A4A" alt="Get Started" />
  </a>
  <a href="#features">
    <img src="https://img.shields.io/badge/FEATURES-C5A55A?style=for-the-badge&color=C5A55A&labelColor=C5A55A" alt="Features" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/LICENCE-Apache%202.0-1B2A4A?style=for-the-badge" alt="License" />
  </a>

</div>

---

<br />

<div align="center">
  <img src="assets/fillwright-architecture.png" alt="Fillwright Architecture Diagram" width="100%" style="max-width:900px; border-radius:8px; box-shadow: 0 2px 12px rgba(27,42,74,0.08);" />
  <p style="color:#666666; font-size:12px; margin-top:6px;"><em>Architecture overview: DOM Scanner, Profile Store, Gemini Nano, MCP Executor, Confirmation UI</em></p>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Licence](#licence)

---

## Overview

Fillwright is a Chrome browser extension that intelligently autofills multi-step forms using **Gemini Nano**, Google's on-device AI model accessible via the Chrome Prompt API. It scans page schemas, reasons over field context, and performs safe DOM mutations through a **WebMCP tool surface**.

All processing happens locally. No field data, profile information, or form content ever leaves the device.

---

## Features

| Feature | Description |
|---------|-------------|
| **Privacy-First** | All data stays on your device. No cloud sync, no telemetry, no external API calls |
| **Gemini Nano** | Uses Chrome's built-in Prompt API for intelligent form understanding and filling |
| **WebMCP Tool Surface** | Safe DOM mutations via a structured tool layer. No LLM sits in the mutation path |
| **Encrypted Profiles** | AES-GCM encryption with PBKDF2 key derivation. Profile data locked at rest |
| **Multi-Step Wizards** | Detects and navigates multi-step forms, filling each page sequentially |
| **Framework-Safe** | Works with React, Vue, Angular, Svelte. Uses native setter + event dispatch |
| **Confirmation Overlay** | Shadow DOM overlay with accept/reject per field before changes are committed |
| **Deterministic Fallback** | When Gemini Nano is unavailable, falls back to autocomplete/label matching |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode) |
| **Build** | Vite |
| **AI** | Chrome Prompt API (LanguageModel) |
| **Tools** | WebMCP |
| **Storage** | IndexedDB + WebCrypto (AES-GCM) |
| **Unit Tests** | Vitest |
| **E2E Tests** | Playwright |

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later
- **Chrome** 131 or later with Gemini Nano support enabled

### Install and Run

```bash
# Clone the repository
git clone https://github.com/yasserrmd/fillwright.git
cd fillwright

# Install dependencies
npm install

# Start the dev server (opens demo forms automatically)
npm run dev
```

The dev server runs at `http://localhost:5173/` and opens the demo page with three sample forms.

### Build for Production

```bash
npm run build
```

### Load as Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` directory

---

## Project Structure

```
fillwright/
  src/
    scanner/          DOM scanning and field schema generation
    mcp/              WebMCP tool surface and executor
    nano/             Gemini Nano client, orchestration, and fallback
    store/            Encrypted profile store (AES-GCM + PBKDF2)
    ui/               Confirmation overlay (Shadow DOM)
    types/            Shared TypeScript types
    main.ts           Entry point and initialization
  demo/               Sample host forms (plain, wizard, locale)
  e2e/                Playwright end-to-end tests
  docs/               Architecture, security, and limitations docs
  assets/             Logo and diagram images
```

---

## How It Works

Fillwright follows a **scan, plan, execute, correct** loop:

1. **Scan** -- The DOM scanner crawls the page, extracts field schemas (name, type, label, autocomplete, validation), prunes hidden elements, and assigns stable IDs
2. **Plan** -- Gemini Nano (or the deterministic fallback matcher) reads the field schemas alongside profile data and produces a fill plan mapping each field to a value
3. **Execute** -- The MCP executor applies each fill operation via native setters and framework-compatible event dispatch
4. **Correct** -- A confirmation overlay presents each change for user acceptance before it is committed to the DOM

All of this happens on-device. No data is transmitted externally at any point.

---

## Testing

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run e2e

# Linting
npm run lint

# Type checking
npm run typecheck
```

---

## Documentation

- [Architecture](docs/architecture.md) -- Component overview and data flow
- [Security Model](docs/security.md) -- Encryption, key derivation, and threat model
- [Limitations](docs/limitations.md) -- Known limitations and browser constraints

---

## Contributing

Contributions are welcome. Please follow the existing code conventions and ensure all tests pass before submitting.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a pull request

---

## Licence

Licensed under the [Apache License, Version 2.0](LICENSE).

---

<div align="center" style="margin-top:24px; padding-top:12px; border-top:2px solid #C5A55A; color:#888; font-size:11px;">
  <p>Mohamed Yasser | Solutions Architect</p>
  <p style="color:#C5A55A;">&#9670;</p>
</div>
