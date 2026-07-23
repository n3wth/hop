---
title: Genericize competitor AI branding across all public surfaces
date: 2026-07-23
tags: [compliance, branding, mcp, seo, public-ui]
files: [app/mcp/page.tsx, components/McpAccess.tsx, app/support/page.tsx, app/account/page.tsx]
status: solved
---

## Problem

Compliance and policy guidelines require that public-facing UI surfaces do not name or promote third-party AI assistant brands (e.g. Claude, ChatGPT, Anthropic) over generic protocol terms. While initial genericization changes covered authenticated account pages (`/account`), support pages (`/support`), and client pickers (`McpAccess.tsx`), discoverable public landing pages such as `/mcp` still retained specific competitor references in page metadata descriptions, config block labels, terminal commands, and usage instructions.

## Solution

1. **Public MCP Landing Page Genericization (`app/mcp/page.tsx`)**:
   - Updated `pageMeta` metadata description to list generic/editor clients (`Cursor`, `VS Code`, `any MCP client`).
   - Replaced provider-specific configuration variables (`CLAUDE_DESKTOP_CONFIG`, `CLAUDE_CODE_CMD`) with generic `MCP_CONFIG_JSON` (`mcp_config.json`).
   - Standardized client setup instructions to refer to protocol-generic usage rather than named third-party products.

2. **Verification & Pipeline Validation**:
   - Ran complete `npm run check` test suite (migration sequence, ESLint, TypeScript typecheck, Vitest).
   - Verified static rendering of `/mcp` via Vercel preview deployment.
   - Merged PR #315 into `main` after resolving reviewer findings.
