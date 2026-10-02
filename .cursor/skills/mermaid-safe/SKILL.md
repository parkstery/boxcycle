---
name: mermaid-safe
description: >-
  Write Mermaid diagrams that render in Cursor IDE chat without Syntax Error.
  NEVER use %%{init}, themeVariables, or theme JSON. Use pure Mermaid only.
  Use whenever writing mermaid, flowchart, sequenceDiagram, erDiagram,
  architecture diagram, or any ```mermaid block in chat or markdown.
---

# Mermaid safe for Cursor chat

Cursor's chat Mermaid parser breaks on `%%{init: ...}%%`. Old RTW `document/*.md` diagrams still use init for other viewers — **never copy that pattern into chat or new docs**.

## Before every Mermaid block

1. No `%%{init`
2. No theme JSON
3. No prose inside the fence
4. Close the fence, then write explanation

## Allowed shape

```mermaid
flowchart LR
  a[label one] --> b[label two]
```

## Forbidden

- `%%{init: { ... }}%%`
- `themeVariables` / `mainBkg` / `darkMode` in Mermaid
- `<br/>` inside nodes
- Explanatory text inside the fence

## Project rule

Also enforced by `.cursor/rules/mermaid-cursor-safe.mdc` (`alwaysApply: true`).
