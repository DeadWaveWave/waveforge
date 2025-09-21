# 开发日志: 移除实时 Lint 功能并添加 Debug 模式

**任务/故事**: 移除实时 Lint 功能并添加 Debug 模式
**日期**: 2025-05-27
**作者**: Gemini
**版本 PRD**: N/A
**Story PRD**: N/A

## 1. 摘要

本次开发主要完成了两个任务：

1.  移除了前端 Monaco 编辑器的实时 lint 功能，因其仅支持 JavaScript 且效果不佳。相关的 perception 和 guidance 逻辑也进行了清理，但保留了用户行为感知（idle, frequent editing）的基础设施。
2.  为前端 UI 添加了 debug 模式控制功能，允许通过环境变量独立控制三个调试组件（Guidance Debug, Error State Debug, Perception Status）的显示，并创建了相应的说明文档。

## 2. 文件变更/新增

- `codewave/frontend/mvp-app/src/App.tsx` (修改 - 移除 hasLintErrors 引用，添加 debug 模式控制逻辑)
- `codewave/frontend/mvp-app/src/features/perception/usePerception.ts` (修改 - 移除 lint 检测逻辑，保留 idle 和 frequent editing)
- `codewave/frontend/mvp-app/src/features/perception/types.ts` (修改 - 更新 PerceptionState，移除 lint 相关属性)
- `codewave/frontend/mvp-app/src/features/guidance/useGuidance.ts` (修改 - 移除 lintError 指导逻辑)
- `codewave/frontend/mvp-app/src/features/guidance/types.ts` (修改 - 更新 GuidanceType 和 UseGuidanceProps，移除 lint 相关类型)
- `codewave/frontend/mvp-app/src/utils/debugConfig.ts` (新增 - 实现 debug 模式配置工具)
- `codewave/frontend/mvp-app/DEBUG_FEATURES.md` (新增 - 创建 debug 功能说明文档)

## 3. 关键技术决策

- **保留部分 Perception 功能**: 决定不完全删除 perception 模块，而是仅移除与 Monaco 实时 lint 相关的部分（`hasLintErrors`, `markers`），保留了 `isIdle` 和 `isFrequentEditing` 的检测逻辑，为未来可能的用户行为分析或更智能的指导留下基础。
- **环境变量控制 Debug 模式**: 采用 Vite 的环境变量 (`import.meta.env.VITE_*`) 结合 `import.meta.env.DEV` 来控制 debug UI 的显示。这样可以确保 debug 功能只在开发模式下生效，且可以独立开关各个调试组件。
- **不修改后端指导**: 确认 `useRuntimeGuidance` 是处理后端执行结果的错误指导，与前端实时 lint 无关，因此未作修改。

## 4. 主要挑战与解决方案

- **准确识别清理范围**: 初期对 "lint" 功能的理解不够清晰，差点误删与后端错误处理相关的指导。通过与用户沟通和仔细分析代码，明确了清理范围仅限于前端 Monaco 编辑器的实时 lint。
- **ESLint `any` 类型警告**: 在修改 `usePerception.ts` 时，由于移除了部分 Monaco 类型导入，导致一些变量被推断为 `any`。通过查阅 Monaco 文档和代码上下文，为 `contentChangeListenerDisposable` 和 `cursorChangeListenerDisposable` 提供了更准确的类型 ` { dispose: () => void } | null`。
- **Vite 环境变量导入问题**: 在 App.tsx 中添加 debug 模式控制时，由于编辑器自动导入的问题，导致 `shouldShowGuidanceDebug` 未能正确导入，引发了类型错误。通过手动检查和修正导入语句解决了问题。

## 5. 测试总结

- **手动测试**:
  - 验证了移除实时 lint 后，编辑器不再显示实时错误标记。
  - 验证了原有的 idle 和 frequent editing 行为感知提示（通过 debug 模式开启）仍然按预期工作。
  - 通过设置不同的环境变量，验证了三个 debug UI 组件（Guidance Debug, Error State Debug, Perception Status）可以被独立控制显示和隐藏。
  - 验证了在生产模式下（通过 `npm run build` 和 `npm run preview`），即使设置了 debug 环境变量，debug UI 也不会显示。
- **单元测试**: 无新增或修改的单元测试。
- **代码质量**:
  - ESLint 检查通过（针对修改和新增的文件）。
  - TypeScript 类型检查 (`npm run type-check`) 通过。
  - 代码格式化符合项目规范。

## 6. 技术债管理

- **`tooling-editor-debt.md`**:
  - **增强 Monaco Linting**: 本次移除了基础的 linting 功能，使得此项技术债更加明确。未来如果需要前端 linting，应考虑集成更强大的 Linter 或 Language Server。将此项标记为与本次改动相关。

## 7. 教训与反思 (Lessons Learned / Reflection)

- **明确需求边界**: 在进行清理或重构任务时，务必与提出者充分沟通，确保对需求的边界和目标有清晰一致的理解，避免误删或过度修改。
- **Vite 环境变量**: 熟悉 Vite 对环境变量的处理方式 (`import.meta.env.VITE_*` 和 `import.meta.env.DEV`) 对于实现开发/生产环境的差异化功能非常重要。
- **逐步验证**: 在进行多文件修改时，进行小步提交和验证（如类型检查、lint 检查）有助于及早发现问题，减少调试复杂度。

## 8. 流程改进 (Process Improvements Implemented)

- 无

## 9. 后续行动 (Next Steps / Follow-up)

- 等待用户确认本次开发结果。
- 根据用户反馈进行可能的调整。
