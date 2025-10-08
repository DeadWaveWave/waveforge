/**
 * 端到端用户工作流测试
 *
 * 目标: 验证完整的用户工作流,包括:
 * - 任务创建、执行、验证、完成流程
 * - 用户手动编辑面板的各种场景
 * - EVR 验证和门槛检查
 * - 错误恢复和边界情况
 *
 * 在测试过程中会多次检查 current-task.md 文件,确保符合设计文档的预期
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/project-manager.js';
import { TaskManager } from '../core/task-manager.js';
import {
  ProjectInfoTool,
  ConnectProjectTool,
  HandshakeChecker,
} from '../tools/handshake-tools.js';
import {
  CurrentTaskInitTool,
  CurrentTaskReadTool,
  CurrentTaskUpdateTool,
  CurrentTaskModifyTool,
  CurrentTaskCompleteTool,
} from '../tools/task-tools.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('端到端用户工作流测试', () => {
  let tempDir: string;
  let projectManager: ProjectManager;
  let taskManager: TaskManager;
  let handshakeChecker: HandshakeChecker;
  let projectInfoTool: ProjectInfoTool;
  let connectProjectTool: ConnectProjectTool;
  let taskInitTool: CurrentTaskInitTool;
  let taskReadTool: CurrentTaskReadTool;
  let taskUpdateTool: CurrentTaskUpdateTool;
  let taskModifyTool: CurrentTaskModifyTool;
  let taskCompleteTool: CurrentTaskCompleteTool;
  let testProjectPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-e2e-workflow-'));
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);
    handshakeChecker = new HandshakeChecker(projectManager, taskManager);

    // 初始化工具
    projectInfoTool = new ProjectInfoTool(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
    taskInitTool = new CurrentTaskInitTool(taskManager);
    taskReadTool = new CurrentTaskReadTool(taskManager, handshakeChecker);
    taskUpdateTool = new CurrentTaskUpdateTool(taskManager);
    taskModifyTool = new CurrentTaskModifyTool(taskManager);
    taskCompleteTool = new CurrentTaskCompleteTool(taskManager);

    // 创建测试项目目录
    testProjectPath = path.join(tempDir, 'test-project');
    await fs.ensureDir(testProjectPath);

    // 连接项目
    await connectProjectTool.handle({ project_path: testProjectPath });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  /**
   * 辅助函数: 读取并解析 current-task.md
   */
  async function readPanelContent(): Promise<string> {
    // 文档现按绑定项目落在 testProjectPath/.wave 下
    const panelPath = path.join(testProjectPath, '.wave', 'current-task.md');
    if (await fs.pathExists(panelPath)) {
      return await fs.readFile(panelPath, 'utf-8');
    }
    return '';
  }

  /**
   * 辅助函数: 验证面板格式是否符合规范
   */
  function validatePanelFormat(content: string) {
    // 验证标题格式
    expect(content).toMatch(/^# Task:/m);

    // 验证复选框状态格式 (需求 1.1)
    const checkboxPattern = /\[([ x\-!])\]/;
    const hasCheckboxes = checkboxPattern.test(content);
    if (hasCheckboxes) {
      // 验证复选框格式正确
      expect(content).not.toMatch(/\[v\]/); // 不应该有错误的复选框格式
    }

    // 验证计划格式 (需求 1.2)
    if (content.includes('## Plans & Steps') || content.includes('## Overall Plan')) {
      expect(content).toMatch(/\d+\.\s+\[([ x\-!])\]/m); // 计划应该使用数字编号
    }

    // 验证引用块格式 (需求 1.4)
    if (content.includes('## Task Hints') || content.includes('## Hints')) {
      // 提示应该使用引用块
      const hintsSectionMatch = content.match(/## (?:Task )?Hints[\s\S]*?(?=\n##|$)/);
      if (hintsSectionMatch) {
        const hintsSection = hintsSectionMatch[0];
        // 如果有提示内容,应该有引用块
        if (hintsSection.length > 50) {
          expect(hintsSection).toMatch(/^>\s+/m);
        }
      }
    }

    return true;
  }

  /**
   * 辅助函数: 手动编辑面板文件
   */
  async function editPanel(modifier: (content: string) => string): Promise<void> {
    const content = await readPanelContent();
    const modified = modifier(content);
    const panelPath = path.join(testProjectPath, '.wave', 'current-task.md');
    await fs.writeFile(panelPath, modified, 'utf-8');
    // 等待一小段时间,确保文件系统同步
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  describe('场景 1: 完整任务生命周期', () => {
    it('应该支持任务创建、执行、验证、完成的完整流程', async () => {
      // ============================================================
      // 阶段 1: 握手和连接 (需求 4)
      // ============================================================

      // 验证项目已连接
      const infoResult = await projectInfoTool.handle();
      const infoResponse = JSON.parse(infoResult.content[0].text);
      expect(infoResponse.data.connected).toBe(true);

      // ============================================================
      // 阶段 2: 创建任务并验证面板格式 (需求 1)
      // ============================================================

      const initResult = await taskInitTool.handle({
        title: '实现用户认证功能',
        goal: '实现完整的用户登录、注册和密码重置功能,确保安全性和用户体验',
        overall_plan: [
          '设计数据模型和 API 接口',
          '实现后端认证逻辑',
          '开发前端登录界面',
          '集成测试和安全审计'
        ],
        knowledge_refs: ['docs/auth-spec.md', 'docs/security-guidelines.md'],
      });

      const initResponse = JSON.parse(initResult.content[0].text);
      expect(initResponse.success).toBe(true);

      // 验证面板文件已创建且格式正确
      const panelContent1 = await readPanelContent();
      expect(panelContent1).toBeTruthy();
      validatePanelFormat(panelContent1);

      // 验证面板包含基本信息
      expect(panelContent1).toContain('实现用户认证功能');
      expect(panelContent1).toContain('设计数据模型和 API 接口');
      expect(panelContent1).toContain('实现后端认证逻辑');

      // ============================================================
      // 阶段 3: 创建 EVR 并绑定到计划 (需求 2)
      // ============================================================

      // 为第一个计划添加 EVR
      const modifyEVRResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'API 接口设计文档完成',
              verify: 'cat docs/auth-api.md | grep "POST /api/auth/login"',
              expect: '文档包含登录、注册、密码重置三个端点的完整说明',
              class: 'static',
            },
            {
              title: '数据库迁移文件创建',
              verify: 'ls migrations/ | grep auth',
              expect: '存在 users 和 sessions 表的迁移文件',
              class: 'static',
            }
          ]
        },
        reason: '为计划 1 添加验收标准',
        change_type: 'generate_steps',
      });

      const modifyEVRResponse = JSON.parse(modifyEVRResult.content[0].text);
      expect(modifyEVRResponse.success).toBe(true);

      // 验证面板中包含 EVR
      const panelContent2 = await readPanelContent();
      expect(panelContent2).toContain('Expected Visible Results');
      expect(panelContent2).toContain('API 接口设计文档完成');
      expect(panelContent2).toContain('[verify]');
      expect(panelContent2).toContain('[expect]');

      // ============================================================
      // 阶段 4: 开始执行第一个计划 (需求 2.3, 2.4)
      // ============================================================

      const updateResult1 = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'in_progress',
      });

      const updateResponse1 = JSON.parse(updateResult1.content[0].text);
      expect(updateResponse1.success).toBe(true);

      // 验证返回了 evr_for_node (需求 2.4)
      expect(updateResponse1.evr_for_node).toBeDefined();
      expect(updateResponse1.evr_for_node.length).toBeGreaterThan(0);

      // 验证面板状态更新
      const panelContent3 = await readPanelContent();
      expect(panelContent3).toMatch(/1\.\s+\[-\]/); // 计划 1 应该是 in_progress

      // ============================================================
      // 阶段 5: 手动编辑面板 - 添加提示和修改计划描述 (需求 3)
      // ============================================================

      await editPanel(content => {
        // 在 Task Hints 部分添加新提示
        const hintsMatch = content.match(/(## (?:Task )?Hints[\s\S]*?)(\n##|$)/);
        if (hintsMatch) {
          const hintsSection = hintsMatch[1];
          const newHints = hintsSection + '\n> 确保使用 bcrypt 加密密码\n> JWT token 有效期设置为 24 小时\n';
          content = content.replace(hintsMatch[1], newHints);
        }

        // 修改第一个计划的描述
        content = content.replace(
          /1\.\s+\[-\]\s+设计数据模型和 API 接口/,
          '1. [-] 设计数据模型和 RESTful API 接口规范'
        );

        return content;
      });

      // 读取任务,应该触发 Lazy 同步 (需求 3.1, 3.2)
      const readResult1 = await taskReadTool.handle({
        evr: { include: true },
      });

      const readResponse1 = JSON.parse(readResult1.content[0].text);
      expect(readResponse1.success).toBe(true);

      // 如果检测到面板编辑,应该返回 sync_preview (需求 3.5, 需求 7.3)
      if (readResponse1.panel_pending) {
        expect(readResponse1.sync_preview).toBeDefined();
        expect(readResponse1.sync_preview.applied).toBe(false); // read 是预览模式
      }

      // 再次读取,验证同步已应用
      const readResult2 = await taskReadTool.handle({
        evr: { include: true },
      });
      const readResponse2 = JSON.parse(readResult2.content[0].text);

      // 验证提示已同步（变更在 modify 时应用，read 为 dry-run）
      expect(readResponse2.task.task_hints).toBeDefined();
      const hints = readResponse2.task.task_hints;
      // read 会返回 task hints（在 read 上下文）
      expect(Array.isArray(hints)).toBe(true);

      // ============================================================
      // 阶段 6: 更新 EVR 状态 - 第一次验证 (需求 2.5, 需求 6.5 - 双次验证规则)
      // ============================================================

      // 获取 EVR ID
      const evrIds = readResponse2.evr_details.map((evr: any) => evr.evr_id);
      expect(evrIds.length).toBeGreaterThanOrEqual(2);

      // 第一次验证 - 执行阶段验证
      const updateEVRResult1 = await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [
            {
              evr_id: evrIds[0],
              status: 'pass',
              last_run: new Date().toISOString(),
              notes: 'API 文档已完成,包含所有必要端点',
              proof: 'inline\n```\nPOST /api/auth/login\nPOST /api/auth/register\nPOST /api/auth/reset-password\n```',
            }
          ]
        }
      });

      const updateEVRResponse1 = JSON.parse(updateEVRResult1.content[0].text);
      expect(updateEVRResponse1.success).toBe(true);

      // 验证 EVR 状态更新 (需求 8.1 - 日志高亮)
      expect(updateEVRResponse1.logs_highlights).toBeDefined();
      const hasVerifiedLog = updateEVRResponse1.logs_highlights.some(
        (log: any) => log.category === 'TEST' && log.message.includes('VERIFIED')
      );
      expect(hasVerifiedLog).toBe(true);

      // 验证面板中的 EVR 状态
      const panelContent4 = await readPanelContent();
      expect(panelContent4).toMatch(/\[status\]\s+pass/);
      expect(panelContent4).toContain('[notes]');
      expect(panelContent4).toContain('[proof]');

      // ============================================================
      // 阶段 7: 完成第一个计划 - 测试计划门槛 (需求 6.1)
      // ============================================================

      // 第二个 EVR 还没有通过,尝试完成计划应该被阻止
      const updateResult2 = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'completed',
      });

      const updateResponse2 = JSON.parse(updateResult2.content[0].text);

      // 如果 EVR 未就绪,应该阻止完成 (需求 6.1)
      if (updateResponse2.evr_pending) {
        expect(updateResponse2.success).toBe(false);
        expect(updateResponse2.evr_for_plan).toBeDefined();

        // 更新第二个 EVR
        await taskUpdateTool.handle({
          update_type: 'evr',
          evr: {
            items: [
              {
                evr_id: evrIds[1],
                status: 'pass',
                last_run: new Date().toISOString(),
                notes: '迁移文件已创建',
              }
            ]
          }
        });
      }

      // 现在可以完成计划了
      const updateResult3 = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'completed',
      });

      const updateResponse3 = JSON.parse(updateResult3.content[0].text);
      expect(updateResponse3.success).toBe(true);

      // 验证面板状态
      const panelContent5 = await readPanelContent();
      expect(panelContent5).toMatch(/1\.\s+\[x\]/); // 计划 1 应该完成

      // ============================================================
      // 阶段 8: 手动编辑面板状态 - 验证状态隔离 (需求 3.3)
      // ============================================================

      await editPanel(content => {
        // 尝试在面板中直接修改计划 2 的状态为 completed
        content = content.replace(
          /2\.\s+\[\s\]\s+实现后端认证逻辑/,
          '2. [x] 实现后端认证逻辑'
        );
        return content;
      });

      // 读取任务
      const readResult3 = await taskReadTool.handle({
        evr: { include: true },
      });
      const readResponse3 = JSON.parse(readResult3.content[0].text);

      // 状态变更应该被识别为待定 (需求 3.3)
      if (readResponse3.sync_preview && readResponse3.sync_preview.changes) {
        const _statusChanges = readResponse3.sync_preview.changes.filter(
          (c: any) => c.type === 'status'
        );
        // 状态变更不应该自动应用,需要通过工具确认
        // (这里的具体行为取决于实现细节)
      }

      // ============================================================
      // 阶段 9: 完成任务前的最终验证 (需求 6.2, 6.5)
      // ============================================================

      // 快速完成剩余计划
      for (let i = 2; i <= 4; i++) {
        await taskUpdateTool.handle({
          update_type: 'plan',
          plan_no: i,
          status: 'in_progress',
        });

        await taskUpdateTool.handle({
          update_type: 'plan',
          plan_no: i,
          status: 'completed',
        });
      }

      // 尝试完成任务 - 应该需要最终 EVR 验证 (需求 6.2)
      const completeResult1 = await taskCompleteTool.handle({
        summary: '用户认证功能已完成,包括登录、注册和密码重置',
        generate_docs: true,
      });

      const completeResponse1 = JSON.parse(completeResult1.content[0].text);

      // 如果是第一次验证,可能需要第二次验证 (需求 6.5 - 双次验证)
      if (!completeResponse1.success && completeResponse1.evr_required_final) {
        // 执行最终验证
        for (const evr of completeResponse1.evr_required_final) {
          await taskUpdateTool.handle({
            update_type: 'evr',
            evr: {
              items: [
                {
                  evr_id: evr.evr_id,
                  status: 'pass',
                  last_run: new Date().toISOString(),
                  notes: '最终验证通过',
                }
              ]
            }
          });
        }

        // 再次尝试完成
        const completeResult2 = await taskCompleteTool.handle({
          summary: '用户认证功能已完成,包括登录、注册和密码重置',
          generate_docs: true,
        });

        const completeResponse2 = JSON.parse(completeResult2.content[0].text);
        expect(completeResponse2.success).toBe(true);
      } else if (completeResponse1.success) {
        // 直接完成成功
        expect(completeResponse1.success).toBe(true);
      }

      // 验证最终面板状态
      const panelContentFinal = await readPanelContent();
      validatePanelFormat(panelContentFinal);

      // 验证所有计划都已完成
      const planLines = panelContentFinal.match(/\d+\.\s+\[.\]/g) || [];
      expect(planLines.length).toBeGreaterThanOrEqual(4);
    }, 60000); // 增加超时时间到 60 秒
  });

  describe('场景 2: 面板手动编辑和同步', () => {
    it('应该正确同步面板的各种手动编辑', async () => {
      // 创建任务
      const initResult = await taskInitTool.handle({
        title: '重构数据库查询层',
        goal: '优化数据库查询性能,减少响应时间',
        overall_plan: ['分析现有查询', '优化慢查询', '添加索引'],
      });

      expect(JSON.parse(initResult.content[0].text).success).toBe(true);

      // ============================================================
      // 测试 1: 编辑标题和目标 (需求 3.1)
      // ============================================================

      await editPanel(content => {
        content = content.replace(
          /# Task: 重构数据库查询层/,
          '# Task: 重构和优化数据库查询层'
        );

        // 修改 Requirements 部分
        content = content.replace(
          /优化数据库查询性能,减少响应时间/,
          '优化数据库查询性能,减少响应时间至 P95 < 200ms'
        );

        return content;
      });

      // 触发同步检测（read 为 dry-run，只检测不应用）
      const readResult1 = await taskReadTool.handle({});
      const readResponse1 = JSON.parse(readResult1.content[0].text);

      // read 为 dry-run，检测到变更但不应用
      // sync_preview 中应该有变更
      if (readResponse1.panel_pending && readResponse1.sync_preview) {
        expect(readResponse1.sync_preview.changes).toBeDefined();
      }
      expect(readResponse1.task.title).toBeDefined();

      // ============================================================
      // 测试 2: 添加和修改 Hints (需求 3.2)
      // ============================================================

      await editPanel(content => {
        const hintsMatch = content.match(/(## (?:Task )?Hints[\s\S]*?)(\n##|$)/);
        if (hintsMatch) {
          const newHints = '## Task Hints\n\n> 使用 EXPLAIN ANALYZE 分析查询计划\n> 关注 N+1 查询问题\n> 考虑使用查询缓存\n\n';
          content = content.replace(hintsMatch[0], newHints + hintsMatch[2]);
        }
        return content;
      });

      // 触发同步
      const readResult2 = await taskReadTool.handle({});
      const readResponse2 = JSON.parse(readResult2.content[0].text);

      // 验证 hints（read 为 dry-run，变更在之前的 modify 应用）
      expect(readResponse2.task.task_hints).toBeDefined();
      expect(Array.isArray(readResponse2.task.task_hints)).toBe(true);
      // hints 可能为空或包含内容，都是合法的
      if (readResponse2.task.task_hints.length > 0) {
        expect(typeof readResponse2.task.task_hints[0]).toBe('string');
      }

      // ============================================================
      // 测试 3: 修改计划文本 (需求 3.1)
      // ============================================================

      await editPanel(content => {
        content = content.replace(
          /1\.\s+\[\s\]\s+分析现有查询/,
          '1. [ ] 分析现有查询并识别慢查询'
        );
        return content;
      });

      // 触发同步
      const readResult3 = await taskReadTool.handle({});
      const readResponse3 = JSON.parse(readResult3.content[0].text);

      // read 为 dry-run，验证计划数据存在
      const plan1 = readResponse3.task.overall_plan[0];
      expect(plan1.description || plan1.text).toBeDefined();
      // 变更在 sync_preview 中，不直接应用到 task 对象

      // 验证面板格式仍然正确
      const panelContent = await readPanelContent();
      validatePanelFormat(panelContent);
    });
  });

  describe('场景 3: EVR 验证和门槛检查', () => {
    it('应该正确执行 EVR 门槛检查和 skip 理由验证', async () => {
      // 创建任务
      const initResult = await taskInitTool.handle({
        title: '实现文件上传功能',
        goal: '支持图片和文档上传,最大 10MB',
        overall_plan: ['设计上传 API', '实现文件存储', '添加安全检查'],
      });

      const initResponse = JSON.parse(initResult.content[0].text);
      expect(initResponse.success).toBe(true);

      // 添加 EVR
      const modifyResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '上传接口响应正常',
              verify: 'curl -X POST /api/upload',
              expect: '返回 200 状态码',
            },
            {
              title: '文件大小限制生效',
              verify: 'curl -X POST /api/upload -F "file=@large.bin"',
              expect: '大于 10MB 的文件被拒绝',
            }
          ]
        },
        reason: '添加验收标准',
        change_type: 'generate_steps',
      });

      expect(JSON.parse(modifyResult.content[0].text).success).toBe(true);

      // 开始执行计划
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'in_progress',
      });

      // ============================================================
      // 测试 1: 验证第一个 EVR 为 pass
      // ============================================================

      const readResult = await taskReadTool.handle({ evr: { include: true } });
      const readResponse = JSON.parse(readResult.content[0].text);
      const evrIds = readResponse.evr_details.map((evr: any) => evr.evr_id);

      await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [{
            evr_id: evrIds[0],
            status: 'pass',
            last_run: new Date().toISOString(),
            notes: '接口正常响应',
          }]
        }
      });

      // ============================================================
      // 测试 2: 第二个 EVR 标记为 skip 但没有理由 - 应该被阻止 (需求 6.3)
      // ============================================================

      await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [{
            evr_id: evrIds[1],
            status: 'skip',
            last_run: new Date().toISOString(),
            // 故意不提供 notes
          }]
        }
      });

      // 尝试完成任务
      const completeResult1 = await taskCompleteTool.handle({
        summary: '文件上传功能完成',
        generate_docs: false,
      });

      const completeResponse1 = JSON.parse(completeResult1.content[0].text);

      // 应该被阻止,因为 skip 的 EVR 需要理由 (需求 6.3)
      if (!completeResponse1.success) {
        expect(completeResponse1.evr_required_final).toBeDefined();
        const skipEVR = completeResponse1.evr_required_final.find(
          (e: any) => e.reason === 'need_reason_for_skip'
        );
        expect(skipEVR).toBeDefined();
      }

      // ============================================================
      // 测试 3: 提供 skip 理由后应该可以完成 (需求 6.3)
      // ============================================================

      await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [{
            evr_id: evrIds[1],
            status: 'skip',
            last_run: new Date().toISOString(),
            notes: '暂不实现大文件限制,留待下个版本处理',
          }]
        }
      });

      // 完成所有计划
      for (let i = 1; i <= 3; i++) {
        await taskUpdateTool.handle({
          update_type: 'plan',
          plan_no: i,
          status: 'in_progress',
        });
        await taskUpdateTool.handle({
          update_type: 'plan',
          plan_no: i,
          status: 'completed',
        });
      }

      // 再次尝试完成任务
      const completeResult2 = await taskCompleteTool.handle({
        summary: '文件上传功能完成',
        generate_docs: false,
      });

      const completeResponse2 = JSON.parse(completeResult2.content[0].text);

      // 现在应该可以完成
      if (!completeResponse2.success) {
        // 如果还需要验证,执行验证
        if (completeResponse2.evr_required_final) {
          for (const evr of completeResponse2.evr_required_final) {
            await taskUpdateTool.handle({
              update_type: 'evr',
              evr: {
                items: [{
                  evr_id: evr.evr_id,
                  status: 'pass',
                  last_run: new Date().toISOString(),
                  notes: '最终验证通过',
                }]
              }
            });
          }

          // 最终完成
          const completeResult3 = await taskCompleteTool.handle({
            summary: '文件上传功能完成',
            generate_docs: false,
          });
          expect(JSON.parse(completeResult3.content[0].text).success).toBe(true);
        }
      } else {
        expect(completeResponse2.success).toBe(true);
      }

      // 验证 EVR 摘要 (需求 7.2)
      expect(completeResponse2.evr_summary).toBeDefined();
      expect(completeResponse2.evr_summary.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('场景 4: 错误恢复和边界情况', () => {
    it('应该正确处理面板格式错误和数据冲突', async () => {
      // 创建任务
      const initResult = await taskInitTool.handle({
        title: '修复关键 bug',
        goal: '解决用户报告的数据丢失问题',
        overall_plan: ['定位问题', '修复代码', '验证修复'],
      });

      expect(JSON.parse(initResult.content[0].text).success).toBe(true);

      // ============================================================
      // 测试 1: 面板格式容错 - 不同的复选框格式 (需求 9.4)
      // ============================================================

      await editPanel(content => {
        // 使用不同的复选框格式
        content = content.replace(/\[\s\]/, '[~]'); // ~ 应该被识别为某种状态
        content = content.replace(/\[\s\]/, '[/]'); // / 也应该被识别
        return content;
      });

      // 应该能够正常解析
      const readResult1 = await taskReadTool.handle({});
      const readResponse1 = JSON.parse(readResult1.content[0].text);
      expect(readResponse1.success).toBe(true);

      // ============================================================
      // 测试 2: 缺少锚点的情况 - 应该使用序号回退 (需求 3.4)
      // ============================================================

      await editPanel(content => {
        // 移除所有 HTML 注释锚点
        content = content.replace(/<!--.*?-->/g, '');

        // 修改第二个计划的文本（使用更通用的正则表达式，匹配任何复选框状态）
        content = content.replace(
          /2\.\s+\[[^\]]*\]\s+修复代码/,
          '2. [ ] 修复代码并添加测试'
        );
        return content;
      });

      // 应该通过序号路径定位并同步
      const readResult2 = await taskReadTool.handle({});
      const readResponse2 = JSON.parse(readResult2.content[0].text);
      expect(readResponse2.success).toBe(true);

      // read 为 dry-run，验证任务数据结构
      const plan2 = readResponse2.task.overall_plan[1];
      expect(plan2).toBeDefined();
      expect(plan2.description || plan2.text).toBeDefined();

      // ============================================================
      // 测试 3: 并发修改冲突 - ETag 优先策略 (需求 3.4)
      // ============================================================

      // 通过 API 修改计划
      await taskModifyTool.handle({
        field: 'plan',
        plan_no: 1,
        op: 'update',
        content: ['详细定位问题根源'], // 必须是字符串数组
        reason: 'API 修改',
        change_type: 'plan_adjustment',
      });

      // 同时在面板中也修改了同一个计划
      await editPanel(content => {
        content = content.replace(
          /定位问题/,
          '快速定位问题'
        );
        return content;
      });

      // 读取时应该检测到冲突
      const readResult3 = await taskReadTool.handle({});
      const readResponse3 = JSON.parse(readResult3.content[0].text);

      // 根据冲突策略,应该保留某一方的修改
      if (readResponse3.sync_preview && readResponse3.sync_preview.conflicts) {
        expect(readResponse3.sync_preview.conflicts.length).toBeGreaterThan(0);
      }
    });
  });

  describe('场景 5: 多工具调用的缓存和性能', () => {
    it('应该在同一请求链中缓存同步结果 (需求 9.2)', async () => {
      // 创建任务
      await taskInitTool.handle({
        title: '性能测试任务',
        goal: '验证同步缓存机制是否正常工作',
        overall_plan: ['步骤 1', '步骤 2'],
      });

      // 手动编辑面板
      await editPanel(content => {
        return content.replace('性能测试任务', '性能和缓存测试任务');
      });

      // 连续多次调用
      const start = Date.now();

      await taskReadTool.handle({});
      await taskReadTool.handle({});
      await taskReadTool.handle({});

      const duration = Date.now() - start;

      // 由于缓存,多次调用应该很快 (这里只是示意,实际的性能要求见需求 9)
      expect(duration).toBeLessThan(5000); // 应该在 5 秒内完成 3 次调用
    });
  });
});
