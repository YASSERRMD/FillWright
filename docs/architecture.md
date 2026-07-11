# Architecture Overview

Fillwright is a local-first form autofiller that uses Gemini Nano (Chrome built-in AI) to reason over form fields and map profile data to them.

## System Architecture

```
+------------------+     +------------------+     +------------------+
|     Scanner      |     |     Nano         |     |     MCP          |
|                  | --> |                  | --> |                  |
| - DOM walking    |     | - Availability   |     | - Tool surface   |
| - Field schema   |     | - Session mgmt   |     | - DOM mutations  |
| - Token estimate |     | - Prompt builder |     | - Event dispatch |
+------------------+     | - JSON parser    |     +------------------+
                         | - Fallback       |
                         +------------------+
                                |
                         +------------------+
                         |   Orchestration  |
                         |                  |
                         | - Scan-plan-fill |
                         | - Self-correction|
                         | - Event emission |
                         +------------------+
                                |
                         +------------------+
                         |   Confirmation   |
                         |                  |
                         | - Diff overlay   |
                         | - Accept/reject  |
                         | - Submit gate    |
                         +------------------+
```

## Module Responsibilities

### Scanner (`src/scanner/`)
- Walks the live DOM and produces a compact JSON schema of every fillable field
- Detects inputs, textareas, selects, radio groups, checkboxes, and contenteditable elements
- Prunes hidden fields and marks inactive wizard step fields with step_hint
- Generates stable field_ids using a hash of selector, label, and name
- Provides a MutationObserver-backed rescan with debounce

### MCP (`src/mcp/`)
- WebMCP tool surface: the page acts as the MCP server, Nano as the client
- Tools: list_fields, fill_field, select_option, toggle, read_validation_errors, next_step, submit, fill_many
- All DOM mutations happen here using the native prototype setter with event dispatch
- Framework-safe: dispatches bubbling input and change events for React, Vue, Angular, Svelte

### Nano (`src/nano/`)
- Gemini Nano client wrapper around the Chrome built-in Prompt API
- Availability handling with download progress
- Session management with reuse and reset
- Strict JSON output contract: FillPlan array of { tool, field_id, value, confidence }
- Robust parser strips markdown fences, validates schema, filters low-confidence steps
- Deterministic fallback using autocomplete attributes and label heuristics

### Store (`src/store/`)
- IndexedDB-backed encrypted profile store
- AES-GCM encryption with PBKDF2 key derivation via WebCrypto
- Auto-lock after configurable idle timeout
- Flattened profile view for the reasoning layer

### Orchestration (`src/nano/orchestration/`)
- Pure coordination loop: scan, list_fields, build prompt, get FillPlan, execute, validate, correct
- Structured events for every stage (scan_started, plan_received, field_filled, etc.)
- Bounded retry with round caps and stall detector
- No DOM writes here, no model prompt strings beyond calling the Nano prompt builder

### UI (`src/ui/`)
- Shadow-DOM isolated confirmation overlay
- Diff view showing field label, old value, proposed value, and confidence
- Accept all, reject all, or toggle individual fields
- Two modes: review-before-fill and review-before-submit
- Accessible: keyboard navigable, focus trapped, escape closes, aria roles

## Data Flow

1. User activates Fillwright on a page
2. Scanner walks the DOM and produces a FormSchema
3. Orchestrator sends schema + profile to Nano
4. Nano returns a FillPlan (JSON array of steps)
5. Orchestrator executes each step via MCP tools
6. MCP tools dispatch framework-safe events
7. Validation errors are read back
8. If errors exist, Nano is called again for corrections
9. Confirmation overlay shows the diff for user review
10. User accepts/rejects individual fields
11. Submission is gated until user explicitly confirms

## Security Properties

- No field data leaves the device
- No LLM sits in the mutation path
- Profile data encrypted at rest with AES-GCM
- Derived key never persisted
- Auto-lock on idle timeout
