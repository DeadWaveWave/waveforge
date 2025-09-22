# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-09-23

### Added

- **Complete Task Management System Implementation:**
  - `current_task_init`: Initialize new development tasks with goals and plans
  - `current_task_read`: Read complete task state with health checks and formatted output
  - `current_task_update`: Update task/plan/step status with automatic advancement
  - `current_task_modify`: Modify task structure (generate steps, adjust plans, refine goals)
  - `current_task_complete`: Complete tasks and generate documentation recommendations
  - `current_task_log`: Record important events, discussions, and decisions
- **Project Management Tools:**
  - `connect_project`: Connect projects to MCP sessions (renamed from `project_bind`)
  - `project_info`: Get current project information
- **Enhanced Documentation:**
  - Added `SILENT` log level support to prevent MCP communication interference
  - Comprehensive troubleshooting guide (`docs/troubleshooting.md`)
  - Detailed MCP tool usage examples and schemas
- **Quality Improvements:**
  - Complete test coverage for all tools
  - Automated workflow with plan completion and step generation
  - Health checks and data integrity validation

## [0.0.0] - 2025-06-25

### Added

- Initial project structure for the `WaveForge` methodology
- Complete Chinese documentation (`.cursor-zh`) including roles, templates, rules, and examples.
- Complete English translation (`.cursor-en`) of all methodology documents and examples.

### Changed

- Overhauled the main `README.md` for a more professional and visually appealing layout, including a new logo, badges, and a Star History chart.
- Clarified the project's vision and its deep integration with the Cursor editor in the `README.md`.
