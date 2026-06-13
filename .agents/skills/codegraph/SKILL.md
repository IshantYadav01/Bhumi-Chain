---
name: codegraph
description: >
  Use CodeGraph for semantic code understanding, dependency analysis, and
  cross-file refactoring in the project. CodeGraph indexes the codebase into
  a queryable graph so agents can find relevant code, understand relationships,
  and make safe, informed changes.
---

# CodeGraph Skill

CodeGraph is a semantic code indexing and querying tool. It builds a graph of
symbols, types, imports, and relationships across the entire project, stored in
`.codegraph/codegraph.db`. It runs as an MCP server configured in
`opencode.jsonc`.

## When to Use

- You need to understand how a symbol is defined, exported, or used across files.
- You're refactoring and need to find all affected call sites.
- You need to trace data flow or type dependencies across module boundaries.
- You want to find test files related to a source file.
- You need a high-level map of the project structure before making changes.

## Commands

CodeGraph provides these MCP tools:

| Tool | Purpose |
|------|---------|
| `codegraph_search_symbol` | Search for symbols by name (fuzzy) |
| `codegraph_get_symbol` | Get full definition of a symbol by ID |
| `codegraph_get_symbol_usages` | Find all references to a symbol |
| `codegraph_get_outgoing_dependencies` | Get all symbols a file/symbol imports/depends on |
| `codegraph_get_incoming_dependencies` | Get all symbols that depend on a given symbol (reverse dependencies) |
| `codegraph_get_file_symbols` | List all symbols defined in a file |
| `codegraph_get_project_structure` | Get a high-level directory tree |
| `codegraph_get_project_stats` | Get file/line/symbol counts per directory |

## Best Practices

1. **Before editing**: Use `codegraph_get_symbol_usages` to check all callers of a function before renaming or changing its signature.

2. **Before deleting**: Use `codegraph_get_incoming_dependencies` to find everything that depends on a file or symbol.

3. **For cross-module changes**: Use `codegraph_get_outgoing_dependencies` on a file to understand which external packages/types it relies on.

4. **When exploring a new area**: Use `codegraph_get_file_symbols` on the key files to understand what's defined where.

5. **Plan first**: Ask CodeGraph for the project structure and relevant symbol relationships before writing code, especially for multi-file refactors.

## Project Context

CodeGraph is configured via `opencode.jsonc` and indexes all project source files.
The database lives at `.codegraph/codegraph.db` (gitignored). To re-index, run:

```bash
codegraph index
```

from the project root. The MCP server is launched automatically by the editor
when configured.
