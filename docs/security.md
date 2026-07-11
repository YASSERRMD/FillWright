# Security Model

## Privacy First

Fillwright is designed as a local-first tool. No field data, profile data, or form content ever leaves the device.

## Encryption at Rest

- User profiles are encrypted using AES-GCM (256-bit key)
- Keys are derived from a user passphrase using PBKDF2 with 100,000 iterations
- Only ciphertext, salt, and initialization vector are stored in IndexedDB
- The derived key is never persisted
- Plaintext is never logged or written to disk

## No LLM in Mutation Path

The Gemini Nano model only reasons over which values map to which fields. All DOM mutations happen through the MCP tool surface, which uses native prototype setters and event dispatch. The model never directly touches the DOM.

## Auto-Lock

The profile store auto-locks after a configurable idle timeout (default: 5 minutes). On lock, the in-memory key and profile data are zeroed.

## Content Script Isolation

When running as a Chrome extension, Fillwright operates as a content script with isolated world access. The confirmation overlay uses Shadow DOM for style isolation from the host page.

## Submit Gating

The submit tool is always gated. It records intent and returns a pending-confirmation result rather than submitting directly. The user must explicitly confirm via the overlay before any submission occurs.
