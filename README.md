<div align="center">
  <img src="https://raw.githubusercontent.com/DeadWaveWave/waveforge/main/assets/WaveForge.png" alt="WaveForge Logo"/>
  <h1>WaveForge MCP</h1>
  <p><strong>A developer-centric, multi-agent collaboration framework designed for Vibe Coding. Seamlessly integrating task management, real-time collaboration, and knowledge retention to let you and your AIs achieve a state of flow.</strong></p>
  <p>
    <a href="https://github.com/DeadWaveWave/waveforge/stargazers"><img alt="Stargazers" src="https://img.shields.io/github/stars/DeadWaveWave/waveforge?style=for-the-badge&logo=github"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/DeadWaveWave/waveforge?style=for-the-badge&logo=mit"></a>
    <a href="https://github.com/DeadWaveWave/waveforge/pulls"><img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge"></a>
    <a href="https://github.com/DeadWaveWave/waveforge/commits/main"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/DeadWaveWave/waveforge?style=for-the-badge&logo=git"></a>
  </p>
  <p><strong><a href="./README.zh-CN.md">中文</a></strong></p>
</div>

## 🚩 Project Status

WaveForge MCP task management system is now largely complete! Core project management and task management features have been fully implemented and tested. You can start using the complete task management workflow right now. We're continuously optimizing performance and user experience - welcome to try it out and provide feedback!

## 💡 Core Philosophy

- **Vibe Coding Friendly**: Say goodbye to rigid processes. Embrace a "think as you go, change as you chat" development model. WaveForge breaks down tasks into macro-plans and micro-steps, allowing you and AI agents to think in a streamlined, modular way within the same context.
- **Local First, Git Powered**: All task data, logs, and documents are stored as plain text files in the local `.wave` directory. This means you have full control over your data and can use Git for versioning, collaboration, and backups without relying on any external services.
- **Traceable, Not Fabricated**: From requirement sources and Git commits to PR/Issue links and key decisions, WaveForge automatically builds a detailed "provenance chain." Generated Devlogs are based on facts, not AI hallucinations, ensuring every review is well-documented.
- **Automated, Non-intrusive**: The system assists agent development through automated rules (like auto-completing plans and prompting for step generation) and non-intrusive hints, without ever interrupting the AI's development flow. It's a smart co-pilot, not a micromanaging boss.

## ✨ Feature Highlights

- **Intelligent Task System**
  - **Two-Level Task Model**: Easily manage complex tasks with a structure of "Overall Plans" and "Specific Steps." Get a high-level overview while focusing on the immediate task, unifying macro and micro perspectives.
  - **Automation-Driven Workflow**: When the last step of a plan is completed, the system automatically completes the plan and prompts the AI to generate steps for the next one. This "relay race" style of automation makes task progression seamless.
- **Seamless Multi-Agent & Cross-Tool Collaboration**
  - **Unique Project Identifier**: A revolutionary project-binding mechanism eliminates dependency on the current working directory (CWD) or editor workspace. No matter which tool (Cursor, VSCode, Kiro) or terminal you're in, all agents are guaranteed to collaborate within the same project context.
  - **Real-Time Sync Guarantee**: Ensures data consistency and avoids state conflicts during parallel operations by multiple agents through file locking and state versioning.
- **Developer Experience First**
  - **Zero-Config Start & Self-Healing**: On its first run, it automatically and idempotently creates the necessary directory structure, templates, and configuration files. Ready to use out-of-the-box with no tedious setup.
  - **One-Click Devlog Generation**: Upon task completion, a single confirmation automatically generates two styles of development logs from a template: `timeline` (a faithful record of the execution trace) and `narrative` (story-like storytelling). The logs aggregate Git commits, file changes, test results, and key discussions, making documentation effortless.
  - **Comprehensive Traceability (Provenance)**: Automatically collects and organizes all task-related information, including Git commit ranges, PR/Issue links, requirement document paths, and meeting notes, to build a complete traceable information view.

## 🚀 Getting Started

For detailed instructions on installation, configuration, and usage, please see the [**Usage Guide (`USAGE.md`)**](./USAGE.md).

**Quick Start**: Want to jump right in? Check out the [**Quick Start Guide (`docs/quick-start.md`)**](./docs/quick-start.md) for a complete workflow example.

If you encounter any issues, check the [**Troubleshooting Guide (`docs/troubleshooting.md`)**](./docs/troubleshooting.md) for known problems and solutions.

## Roadmap

We are actively working on implementing the following core features. Feel free to join the discussion or contribute!

### Core Framework

- [x] **Project Binding & Environment Self-Healing**
  - [x] `connect_project`: Implement unique binding between a project and the MCP service, eliminating CWD dependency.
  - [x] `project_info`: Get information about the currently bound project.
  - [ ] **Initialization & Self-Healing**: Automatically create the `.wave` directory structure, templates, and config files on the first run.

### Task Management (MCP Tools)

- [x] **Two-Level Task Model**
  - [x] `current_task_init`: Initialize a new task, defining its `goal` and `overall_plan`.
  - [x] `current_task_modify`: Dynamically adjust tasks, including the `plan`, `steps`, `goal`, or adding `hints` for the AI.
  - [x] `current_task_update`: Update the status of a `plan` or `step`.
- [x] **Task Lifecycle**
  - [x] `current_task_read`: Read the full context of the current task to sync between clients.
  - [x] `current_task_complete`: Mark a task as complete and trigger Devlog generation.
  - [ ] `task_list`: View a list of historical tasks.
  - [ ] `task_switch`: Switch between different tasks.
- [x] **Process Logging & Traceability**
  - [x] `current_task_log`: Log key discussions, decisions, or exceptions during development.
  - [ ] **Provenance**: Automatically associate Git commits, PR/Issue links, and other artifacts.

### Automation & Doc Generation

- [x] **Automated Workflow**
  - [x] Automatically mark a plan as completed when all its steps are done.
  - [x] Prompt the AI to generate steps when starting a new plan.
- [x] **Devlog Auto-Generation**
  - [x] Provide development log generation suggestions and templates upon task completion.
  - [ ] `devlog_prepare_context`: Prepare the context needed for Devlog generation.
  - [ ] `generate_devlog`: Populate `timeline` and `narrative` devlogs from templates using task snapshots, logs, and Git history.

## Workflow: From Idea to Implementation

1.  **Project Connection**: Use `connect_project` to bind the project to the MCP session, ensuring all AI agents collaborate within the same context.
2.  **Discuss & Define**: Freely discuss ideas with an AI in any tool. Capture meeting notes and sparks of inspiration as `hints` or `knowledge_refs` to provide context for development.
3.  **Plan & Design**: Use `current_task_init` to start a task. Collaborate with AI agents to create a high-level "Overall Plan."
4.  **Code & Implement**: The agent focuses on the current plan, dynamically generating and executing "Steps." You can guide the agent at any time by adding `hints` manually or via other agents.
5.  **Review & Document**: Once the task is complete, generate a Devlog with one click. Perfect for team sharing, technical reviews, or knowledge retention.

## ⚠️ Important Notes

**Tool Name Change**: Due to discovering potential naming conflicts with `project_bind` in certain IDEs, we've renamed it to `connect_project`. The functionality is identical - only the name has changed. If you encounter issues with tools not responding, please check that you're using the correct tool name.

## 🏗️ Architecture

All of WaveForge's data is stored in the `.wave` folder in your project root. The server logic is organized as follows:

```
src/
├── server.ts              # MCP server entry point
├── core/                  # Core business logic
│   ├── error-handler.ts   # Error handler
│   ├── logger.ts          # Logger
│   └── project-root-manager.ts # Project root manager
├── tools/                 # MCP tool definitions
│   ├── index.ts           # Tool implementations
│   └── schemas.ts         # JSON Schema definitions
├── types/                 # TypeScript type definitions
│   └── index.ts           # Core types
└── adapters/              # Adapter layer
    └── index.ts           # Adapter interfaces
```

## Architecture & File System

All of WaveForge's data is stored in the `.wave` folder in your project root, with a clear and readable structure:

```
.wave/
├── .gitignore            # Ignore local, editable panel files
├── current-task.md       # A global panel for the current task, freely editable locally
├── tasks/
│   ├── index.json        # Index of all tasks
│   ├── _latest.json      # Pointer to the most recently active task
│   ├── views/            # Task view indices (e.g., grouped by slug)
│   └── 2025/09/21/
│       └── <slug>--<id8>/ # Archive directory for a single task
│           ├── task.json             # Task state snapshot (JSON)
│           ├── logs.jsonl            # Structured logs (JSON Lines)
│           ├── devlog.timeline.md    # Timeline-style devlog
│           └── devlog.narrative.md   # Narrative-style devlog
└── templates/
    └── devlog-template.md  # Customizable Devlog template
```

## Toolkit (Future)

One core, two entry points: MCP tools and a native Toolkit for direct agent calls. Stability and evolution will be ensured through a Tool Manifest, capability handshakes, and schema versioning.

## 🤝 Development

We aim for the highest code quality standards.

- **TypeScript**: Written entirely in strict-mode TypeScript.
- **Linting**: ESLint for code analysis.
- **Formatting**: Prettier for consistent code style.
- **Testing**: Vitest as the testing framework with a 100% coverage goal.

## 🙏 Acknowledgements

- **[Model Context Protocol](https://github.com/modelcontextprotocol)**: For the official MCP SDK that makes this possible.
- **[TypeScript](https://www.typescriptlang.org/)**: For bringing type safety to JavaScript.
- **[Vitest](https://vitest.dev/)**: For a blazingly fast testing experience.

## Star History

<a href="https://star-history.com/#DeadWaveWave/waveforge&Date">
  <img src="https://api.star-history.com/svg?repos=DeadWaveWave/waveforge&type=Date" alt="Star History Chart">
</a>

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
