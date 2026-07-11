# Limitations

## Gemini Nano Availability

Gemini Nano is only available in Chrome 131+ on supported devices. When unavailable, Fillwright falls back to a deterministic rule-based system using autocomplete attributes and label heuristics. The fallback is less accurate than the AI-powered path.

## Context Window

Gemini Nano has a small context window. Fillwright trims the field schema and profile view before every prompt. Forms with many fields may be split across multiple passes.

## Framework Compatibility

Fillwright uses the native prototype setter and event dispatch pattern to work with React, Vue, Angular, and Svelte. Some frameworks may use non-standard event handling that requires additional workarounds.

## Contenteditable Fields

Contenteditable elements are detected but filling them reliably depends on how the application handles content updates. Some rich text editors may not register changes from programmatic value setting.

## File Inputs

File input fields cannot be filled programmatically due to browser security restrictions. These fields will be skipped.

## CAPTCHA and Anti-Bot

Fillwright does not attempt to fill CAPTCHA fields, security questions, or anti-bot verification. These fields should be left for manual completion.

## Multi-Tab

The profile store uses a single IndexedDB connection. Concurrent access from multiple tabs may result in data loss. A proper locking mechanism is recommended for multi-tab use.

## Mobile

Fillwright is designed for desktop Chrome. Mobile Chrome does not yet support the built-in Prompt API.
