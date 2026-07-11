# Fillwright

Local-first, multi-step form autofiller. Gemini Nano (Chrome built-in AI) reads page context and reasons over form fields. A WebMCP tool surface performs all DOM mutations. No LLM sits in the mutation path. No field data leaves the device.

## Features

- Privacy-first: all data stays on device
- Uses Gemini Nano for intelligent form filling
- WebMCP tool surface for safe DOM mutations
- Encrypted profile store with AES-GCM
- Multi-step wizard support
- Framework-safe event dispatch (React, Vue, Angular, Svelte)

## Tech Stack

- TypeScript
- Vite
- Chrome built-in Prompt API (LanguageModel)
- WebMCP
- IndexedDB + WebCrypto
- Vitest (unit tests)
- Playwright (e2e tests)

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome with Gemini Nano support

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test
npm run e2e
```

### Linting

```bash
npm run lint
npm run typecheck
```

## Project Structure

```
src/
  scanner/      page scanning and field schema
  mcp/          WebMCP tool surface and executor
  nano/         Gemini Nano client and orchestration
  store/        encrypted profile store
  ui/           confirmation overlay
  types/        shared types
demo/           demo host forms
e2e/            end-to-end tests
```

## License

Apache 2.0
