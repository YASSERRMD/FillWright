<div align="center">

  <img src="assets/fillwright-logo.png" alt="Fillwright Logo" width="200" />

  <h1 style="color:#1B2A4A; font-family:Georgia,serif; border-bottom:3px solid #C5A55A; padding-bottom:8px; display:inline-block;">Fillwright</h1>

  <p style="color:#666666; font-size:16px; margin-top:8px;">
    <strong>Local-first, multi-step form autofiller powered by Gemini Nano</strong>
  </p>

  <p style="color:#666666; font-size:14px;">
    Write a paragraph about yourself. Fillwright fills forms for you.
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
- [How to Use](#how-to-use)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Managing Profiles](#managing-profiles)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Licence](#licence)

---

## Overview

Fillwright is a **Chrome browser extension** that intelligently autofills multi-step forms using **Gemini Nano**, Google's on-device AI model accessible via the Chrome Prompt API. It scans page schemas, reasons over field context, and performs safe DOM mutations through a **WebMCP tool surface**.

All processing happens locally. No field data, profile information, or form content ever leaves the device.

---

## Features

| Feature | Description |
|---------|-------------|
| **Chrome Extension** | Install as a Chrome extension. Click the toolbar icon to manage profiles and fill forms |
| **Privacy-First** | All data stays on your device. No cloud sync, no telemetry, no external API calls |
| **Gemini Nano** | Uses Chrome's built-in Prompt API for intelligent form understanding and filling |
| **WebMCP Tool Surface** | Safe DOM mutations via a structured tool layer. No LLM sits in the mutation path |
| **Conversational Profiles** | Write a paragraph about yourself and Fillwright extracts your data automatically |
| **Editable Profiles** | Create, edit, switch, and delete profiles. Quick (paragraph) or manual (field-by-field) mode |
| **Profile Detail View** | See all stored fields at a glance with the profile detail grid |
| **Encrypted Profiles** | AES-GCM encryption with PBKDF2 key derivation. Profile data locked at rest |
| **Multi-Step Wizards** | Detects and navigates multi-step forms, filling each page sequentially |
| **Framework-Safe** | Works with React, Vue, Angular, Svelte. Uses native setter + event dispatch |
| **Confirmation Overlay** | Shadow DOM overlay with accept/reject per field before changes are committed |
| **Deterministic Fallback** | When Gemini Nano is unavailable, falls back to autocomplete/label matching |
| **No-Profile Warning** | Clear modal dialog if you try to fill without a profile, guiding you to create one |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode) |
| **Build** | Vite (multi-entry: popup, content script, background) |
| **Extension** | Chrome Manifest V3 |
| **AI** | Chrome Prompt API (LanguageModel) |
| **Tools** | WebMCP |
| **Storage** | chrome.storage.local + IndexedDB + WebCrypto (AES-GCM) |
| **Unit Tests** | Vitest |
| **E2E Tests** | Playwright |

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later
- **Chrome** 131 or later with Gemini Nano support enabled

### Install and Build

```bash
# Clone the repository
git clone https://github.com/yasserrmd/fillwright.git
cd fillwright

# Install dependencies
npm install

# Build the Chrome extension
npm run build:ext
```

### Load as Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` directory

The Fillwright icon appears in your Chrome toolbar.

### Development (Demo Page)

```bash
npm run dev
```

Opens the demo page at `http://localhost:5173/` with three sample forms.

---

## How to Use

### 1. Create a Profile

Click the **Fillwright icon** in your Chrome toolbar to open the popup.

- Click the **+** button to create a new profile
- Choose **Quick** mode and write a paragraph about yourself, or **Manual** mode to fill individual fields
- Give your profile a name (e.g. "Personal", "Work", "Partner")
- Click **Save Profile**

**Example paragraph:**

> I am Alice Johnson, a Software Engineer at Acme Corp in the Engineering department.
> My email is alice@acme.com and my phone is +1-555-0123.
> I live at 123 Main Street, Springfield, IL 62701.
> My passport is AB1234567 and my national ID is US-987654321.

Fillwright detects: name, email, phone, address, employer, job title, department, passport, national ID, and custom fields like nationality or language.

### 2. Switch Profiles

Use the dropdown in the popup to switch between saved profiles. The active profile is used when filling forms.

### 3. Fill a Form

Navigate to any form page and click the **Fill Form** button on the page, or click **Fill Form** in the popup. Review the changes in the confirmation overlay before accepting.

### 4. Edit a Profile

Click the **pencil icon** next to the profile dropdown to edit the active profile. Modify any field and click **Save Profile**.

### 5. No Profile Warning

If you click Fill Form without a profile, a modal appears guiding you to open the extension and create one.

---

## Project Structure

```
fillwright/
  src/
    scanner/          DOM scanning and field schema generation
    mcp/              WebMCP tool surface and executor
    nano/             Gemini Nano client, orchestration, fallback, text parser
    store/            Encrypted profile store (AES-GCM + PBKDF2)
    ui/               Confirmation overlay, profile create/edit/selector (Shadow DOM)
    popup/            Extension popup (HTML, CSS, TS)
    types/            Shared TypeScript types
    content.ts        Content script (injected into pages)
    background.ts     Background service worker
  demo/               Sample host forms (plain, wizard, locale)
  e2e/                Playwright end-to-end tests
  docs/               Architecture, security, limitations, profile template
  icons/              Extension icons (MY brand: navy/gold pen nib)
  assets/             Logo and architecture diagram
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

## Managing Profiles

### Profile Modes

| Mode | Description |
|------|-------------|
| **Quick** | Write a paragraph about yourself. Fillwright extracts structured fields automatically |
| **Manual** | Fill individual fields: name, email, phone, address, documents, employment, custom |

### Profile Fields

| Path | Description | Example |
|------|-------------|---------|
| `identity.givenName` | First name | `Alice` |
| `identity.familyName` | Last name | `Johnson` |
| `identity.fullName` | Full name | `Alice Johnson` |
| `identity.preferredName` | Preferred name / nickname | `Alice` |
| `contact.email` | Email address | `alice@example.com` |
| `contact.phone` | Phone number | `+1-555-0123` |
| `contact.addresses.N` | Address at index N | `123 Main St, City` |
| `documents.passport` | Passport number | `AB1234567` |
| `documents.nationalId` | National ID number | `US-987654321` |
| `documents.emiratesId` | Emirates ID | `784-1234-5678901-2` |
| `employment.employer` | Company name | `Acme Corp` |
| `employment.jobTitle` | Job title | `Software Engineer` |
| `employment.department` | Department | `Engineering` |
| `custom.*` | Any custom field | `custom.nationality: Emirati` |

### Multiple Profiles

Create separate profiles for different contexts (Personal, Work, Partner, etc.) and switch between them instantly from the popup dropdown.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run build:ext` | Build the Chrome extension to `dist/` |
| `npm run dev:ext` | Watch mode for extension development |
| `npm run dev` | Demo page with sample forms |
| `npm run build` | Demo page production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run e2e` | Run end-to-end tests (Playwright) |
| `npm run lint` | Lint source files |
| `npm run typecheck` | Type check without emitting |

---

## Testing

```bash
npm run test
npm run e2e
npm run lint
npm run typecheck
```

---

## Documentation

- [Architecture](docs/architecture.md) -- Component overview and data flow
- [Security Model](docs/security.md) -- Encryption, key derivation, and threat model
- [Limitations](docs/limitations.md) -- Known limitations and browser constraints
- [Profile Template](docs/profile-template.json) -- Sample profile JSON

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
