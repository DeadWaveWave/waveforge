# Tooling & Editor Technical Debt Backlog

-   [ ] **增强 Monaco Linting:** Monaco Editor 内置 Linting 对非 JS/TS 语言及某些 JS 语法错误支持有限。**(Updated by 2025-05-27 - Refactor Lint and Add Debug Mode)** 本次开发移除了基础的实时 lint 功能，使得此项技术债更加明确。未来如果需要前端 linting，应考虑集成更强大的 Linter 或 Language Server。 
-   [ ] **编辑器状态重置:** 当前切换题目时仅使用 `editorRef.setValue()` 更新内容，未显式清空撤销/重做栈 (undo/redo stack)。虽然目前影响不大，但可能导致用户撤销到上一个题目的状态。未来可调研并调用 Monaco API 实现更彻底的状态重置。 