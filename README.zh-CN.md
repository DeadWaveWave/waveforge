<div align="center">
  <img src="https://raw.githubusercontent.com/DeadWaveWave/waveforge/main/assets/WaveForge.png" alt="WaveForge Logo"/>
  <h1>WaveForge MCP</h1>
  <p><strong>一个专为 Vibe Coding 设计的、以开发者为中心的多 Agent 协作框架。将任务管理、实时协作与知识沉淀无缝融合，让你和你的 AI 们心流合一，专注创造。</strong></p>
  <p>
    <a href="https://github.com/DeadWaveWave/waveforge/stargazers"><img alt="Stargazers" src="https://img.shields.io/github/stars/DeadWaveWave/waveforge?style=for-the-badge&logo=github"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/DeadWaveWave/waveforge?style=for-the-badge&logo=mit"></a>
  </p>
  <p><strong><a href="./README.md">English</a></strong></p>
</div>

## 项目状态

WaveForge 正处于活跃的设计与开发阶段，核心的 MCP 任务管理与协作框架已设计完成。我们正在积极推进实现，欢迎了解我们的路线图，也欢迎你加入讨论！

## 核心理念

- **Vibe Coding 友好**: 告别僵化的流程，拥抱“边想边做、边聊边改”的开发模式。WaveForge 将任务分解为宏观计划与微观步骤，让你和 AI Agent 可以在同一上下文中流水线式思考、积木式开发。
- **本地优先，Git 赋能**: 所有任务数据、日志和文档都以纯文本文件形式存储在本地的 `.wave` 目录中。这意味着你可以完全掌控自己的数据，并利用 Git 进行版本管理、协作与备份，无需依赖任何外部服务。
- **可溯源，不杜撰**: 从需求来源、Git 提交、PR/Issue 链接到关键决策讨论，WaveForge 会自动为你建立详尽的“证据链”（Provenance）。生成的 Devlog 基于事实，而非 AI 的凭空想象，确保每一次复盘都有据可查。
- **自动化，非侵入式**: 系统通过自动化规则（如计划自动完成、步骤生成提示）和非侵入式的提示（Hints）辅助 Agent 开发，但从不打断 AI 的开发心流。它是一个聪明的副驾驶，而不是一个指手画脚的老板。

## 亮点功能

- **智能任务系统**
    - **双层级任务模型**：通过“整体计划 (Plan)”和“具体步骤 (Step)”的结构，轻松驾驭复杂任务。既能总览全局，又能聚焦当下，实现宏观与微观的统一。
    - **自动化流程驱动**：当计划的最后一步完成时，系统会自动完成该计划并提示 AI 为下一个计划生成步骤。这种“接力棒”式的自动化，让任务推进如丝般顺滑。
- **无缝的多 Agent 与跨工具协作**
    - **项目唯一标识**：革命性的项目绑定机制，彻底摆脱对当前工作目录 (CWD) 或编辑器工作区的依赖。无论你在哪个工具（Cursor, VSCode, Kiro）或终端中，都能确保所有 Agent 在同一个项目上下文中协作，不再有“找不着北”的烦恼。
    - **实时同步保障**：通过文件锁和状态版本控制，确保多个 Agent 并行操作时的数据一致性，避免状态冲突。
- **开发者体验至上**
    - **零配置启动与自愈**：首次运行自动创建所需目录结构、模板和配置文件，并具备幂等性。开箱即用，无需繁琐配置。
    - **一键生成 Devlog**：任务完成后，只需一步确认，即可基于模板自动生成两种风格的开发日志：`timeline`（忠实记录执行轨迹）和 `narrative`（故事化叙事）。日志内容自动聚合 Git 提交、文件变更、测试结果和关键讨论，将繁琐的文档工作化为无形。
    - **全面的可追溯性 (Provenance)**：自动采集和整理与任务相关的一切信息，包括 Git 提交范围、PR/Issue 链接、需求文档路径、会议纪要等，构建完整的可溯源信息视图。

## 功能清单 (Roadmap)

我们正在积极推进以下核心功能的实现，欢迎你加入讨论或贡献代码！

### 核心框架
- [ ] **项目绑定与环境自愈**
    - [ ] `project_bind`: 实现项目与 MCP 服务的唯一绑定，摆脱对 CWD 的依赖。
    - [ ] `project_info`: 获取当前绑定的项目信息。
    - [ ] **初始化与自愈**：首次运行时自动创建 `.wave` 目录结构、模板及配置文件。

### 任务管理工具 (MCP Tools)
- [ ] **双层级任务模型**
    - [ ] `current_task_init`: 初始化新任务，定义目标 (`goal`) 和宏观计划 (`overall_plan`)。
    - [ ] `current_task_modify`: 动态调整任务，支持：
      - `plan`: 整体调整计划。
      - `steps`: 为当前计划生成或修改具体步骤。
      - `goal`: 微调验收标准。
      - `hints`: 为 AI 添加上下文提示。
    - [ ] `current_task_update`: 更新计划 (`plan`) 或步骤 (`step`) 的状态。
- [ ] **任务生命周期**
    - [ ] `current_task_read`: 读取当前任务的完整上下文，便于在不同客户端间同步。
    - [ ] `current_task_complete`: 标记任务完成，并触发开发日志 (Devlog) 生成。
    - [ ] `task_list`: 查看历史任务列表。
    - [ ] `task_switch`: 在不同任务间切换。
- [ ] **过程记录与追溯**
    - [ ] `current_task_log`: 记录开发过程中的关键讨论、决策或异常。
    - [ ] **可追溯性 (Provenance)**: 自动关联 Git 提交、PR/Issue 链接等信息。

### 自动化与文档生成
- [ ] **自动化流程**
    - [ ] 当计划的所有步骤完成后，自动将计划标记为完成。
    - [ ] 当进入新计划时，提示 AI 生成具体步骤。
- [ ] **Devlog 自动生成**
    - [ ] `devlog_prepare_context`: 准备生成 Devlog 所需的上下文。
    - [ ] `generate_devlog`: 基于模板，将任务快照、日志、Git 历史等信息填充为 `timeline` 和 `narrative` 两种风格的开发日志。

## 协作流程：从灵感到实现

1.  **需求与讨论**：在任何工具中与 AI 自由讨论，将会议纪要、灵感火花记录为任务的 `hints`（提示）或 `knowledge_refs`（知识引用），为后续开发提供上下文。
2.  **规划与设计**：通过 `current_task_init` 初始化任务，你和 AI Agent 协同制定出宏观的“整体计划 (Overall Plan)”。
3.  **编码与实现**：Agent 聚焦于当前计划，动态生成并执行“具体步骤 (Steps)”。你随时可以通过手动添加或让其他 Agent 添加 `hints` 来指导和调整 Agent 的行为。
4.  **复盘与沉淀**：任务完成，一键生成 Devlog。无论是用于团队分享、技术复盘还是知识沉淀，都信手拈来。

## 架构与文件系统

WaveForge 的所有数据都存储在项目根目录下的 `.wave` 文件夹中，其结构清晰、可读性强：

```
.wave/
├── .gitignore            # 忽略本地可编辑的面板文件
├── current-task.md       # 全局当前任务面板，可在本地自由编辑
├── tasks/
│   ├── index.json        # 所有任务的索引
│   ├── _latest.json      # 指向最近活跃任务
│   ├── views/            # 任务的视图索引（如按 slug 分组）
│   └── 2025/09/21/
│       └── <slug>--<id8>/ # 单个任务的归档目录
│           ├── task.json             # 任务状态快照 (JSON)
│           ├── logs.jsonl            # 结构化日志 (JSON Lines)
│           ├── devlog.timeline.md    # 时间线风格的开发日志
│           └── devlog.narrative.md   # 叙事风格的开发日志
└── templates/
    └── devlog-template.md  # Devlog 模板，可自定义
```

## Toolkit（未来）

一套核心，两种出入口：MCP 工具 与 原生 Toolkit（Agent 直接调用）。通过 Tool Manifest、能力握手与 Schema 版本化保证稳定演进。

## Star History

<a href="https://star-history.com/#DeadWaveWave/waveforge&Date">
  <img src="https://api.star-history.com/svg?repos=DeadWaveWave/waveforge&type=Date" alt="Star History Chart">
</a>

## 许可协议

本项目使用 MIT License。详见 [LICENSE](./LICENSE)。
