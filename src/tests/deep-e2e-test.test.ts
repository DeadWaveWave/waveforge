/**
 * 深度端到端测试 - 详细验证设计文档符合性
 *
 * 目标：
 * 1. 严格对照 design.md 和 requirements.md 验证每个功能点
 * 2. 记录所有与设计不符的地方
 * 3. 记录所有功能实现的问题
 * 4. 在每个关键步骤后检查 current-task.md 的实际内容
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

describe('深度端到端测试 - 设计文档符合性验证', () => {
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

  // 问题记录
  const designIssues: string[] = [];
  const functionalIssues: string[] = [];

  // 辅助函数：记录设计不符问题
  function recordDesignIssue(issue: string) {
    designIssues.push(issue);
    console.error(`❌ [设计不符] ${issue}`);
  }

  // 辅助函数：记录功能问题
  function recordFunctionalIssue(issue: string) {
    functionalIssues.push(issue);
    console.error(`🐛 [功能问题] ${issue}`);
  }

  // 辅助函数：读取并显示面板内容
  async function readAndLogPanel(stepName: string): Promise<string> {
    // 文档现按绑定项目落在 testProjectPath/.wave 下
    const panelPath = path.join(testProjectPath, '.wave', 'current-task.md');
    if (await fs.pathExists(panelPath)) {
      const content = await fs.readFile(panelPath, 'utf-8');
      console.log(`\n========== ${stepName} - current-task.md 内容 ==========`);
      console.log(content);
      console.log(`========== 内容结束 ==========\n`);
      return content;
    }
    console.log(`⚠️ ${stepName}: current-task.md 文件不存在`);
    return '';
  }

  // 辅助函数：手动编辑面板
  async function editPanel(modifier: (content: string) => string): Promise<void> {
    const panelPath = path.join(testProjectPath, '.wave', 'current-task.md');
    const content = await fs.readFile(panelPath, 'utf-8');
    const modified = modifier(content);
    await fs.writeFile(panelPath, modified, 'utf-8');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deep-e2e-test-'));
    projectManager = new ProjectManager();
    taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);
    handshakeChecker = new HandshakeChecker(projectManager, taskManager);

    projectInfoTool = new ProjectInfoTool(projectManager, taskManager);
    connectProjectTool = new ConnectProjectTool(projectManager, taskManager);
    taskInitTool = new CurrentTaskInitTool(taskManager);
    taskReadTool = new CurrentTaskReadTool(taskManager, handshakeChecker);
    taskUpdateTool = new CurrentTaskUpdateTool(taskManager);
    taskModifyTool = new CurrentTaskModifyTool(taskManager);
    taskCompleteTool = new CurrentTaskCompleteTool(taskManager);

    testProjectPath = path.join(tempDir, 'test-project');
    await fs.ensureDir(testProjectPath);
    await connectProjectTool.handle({ project_path: testProjectPath });

    // 清空问题记录
    designIssues.length = 0;
    functionalIssues.length = 0;
  });

  afterEach(async () => {
    await fs.remove(tempDir);

    // 输出问题汇总
    if (designIssues.length > 0 || functionalIssues.length > 0) {
      console.log('\n========== 问题汇总 ==========');
      if (designIssues.length > 0) {
        console.log('\n设计不符问题:');
        designIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
      }
      if (functionalIssues.length > 0) {
        console.log('\n功能问题:');
        functionalIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
      }
      console.log('=============================\n');
    }
  });

  describe('测试 1: 面板格式规范验证 (需求 1)', () => {
    it('应该严格按照设计文档生成面板格式', async () => {
      console.log('\n========== 开始测试面板格式规范 ==========\n');

      // 创建任务
      const initResult = await taskInitTool.handle({
        title: '实现用户认证系统',
        goal: '完整的登录注册功能，支持 JWT 认证和密码加密',
        overall_plan: ['设计数据库', '实现 API', '编写测试'],
      });

      const initResponse = JSON.parse(initResult.content[0].text);
      expect(initResponse.success).toBe(true);

      // 检查点 1: 初始面板生成
      const panel1 = await readAndLogPanel('初始任务创建后');

      // 需求 1.1: 验证复选框格式
      console.log('\n>>> 验证需求 1.1: 复选框格式');
      const checkboxPattern = /\[([ x\-!])\]/g;
      const checkboxes = panel1.match(checkboxPattern);

      if (!checkboxes || checkboxes.length === 0) {
        recordDesignIssue('需求 1.1: 面板中没有找到任何复选框');
      } else {
        console.log(`✓ 找到 ${checkboxes.length} 个复选框`);

        // 检查是否有错误的复选框格式
        const invalidCheckboxes = panel1.match(/\[([^x\-!\s]|[a-z]|[A-Z])\]/g);
        if (invalidCheckboxes) {
          recordDesignIssue(`需求 1.1: 发现无效的复选框格式: ${invalidCheckboxes.join(', ')}`);
        }
      }

      // 需求 1.2: 验证计划编号格式
      console.log('\n>>> 验证需求 1.2: 计划使用自然计数格式');
      const planPattern = /\d+\.\s+\[([ x\-!])\]\s+.+/g;
      const plans = panel1.match(planPattern);

      if (!plans || plans.length < 3) {
        recordDesignIssue(`需求 1.2: 期望找到 3 个编号的计划，实际找到 ${plans?.length || 0} 个`);
      } else {
        console.log(`✓ 找到 ${plans.length} 个编号的计划`);
        plans.forEach(plan => console.log(`  - ${plan}`));
      }

      // 需求 1.4: 验证 Task Hints 使用引用块格式
      console.log('\n>>> 验证需求 1.4: Task Hints 应该使用引用块');

      // 先添加一些 hints
      await taskModifyTool.handle({
        field: 'goal',
        op: 'replace',
        content: '完整的登录注册功能，支持 JWT 认证和密码加密',
        hints: ['使用 bcrypt 加密密码', 'JWT token 有效期 24 小时'],
        reason: '添加提示',
        change_type: 'user_request',
      });

      const panel2 = await readAndLogPanel('添加 hints 后');

      const hintsSection = panel2.match(/## (?:Task )?Hints([\s\S]*?)(?=\n##|$)/);
      if (!hintsSection) {
        recordDesignIssue('需求 1.4: 面板中没有找到 Task Hints 部分');
      } else {
        const hintsSectionContent = hintsSection[1];
        const quoteBlocks = hintsSectionContent.match(/^>\s+/gm);

        if (!quoteBlocks || quoteBlocks.length === 0) {
          recordDesignIssue('需求 1.4: Task Hints 没有使用引用块格式 (>)');
          console.log('实际格式:\n' + hintsSectionContent);
        } else {
          console.log(`✓ Task Hints 使用了引用块格式，找到 ${quoteBlocks.length} 个引用行`);
        }
      }

      // 需求 1.5: 验证稳定锚点 ID
      console.log('\n>>> 验证需求 1.5: 计划应该有稳定锚点 ID');
      const anchorPattern = /<!--\s*plan:[a-z0-9-]+\s*-->/g;
      const anchors = panel2.match(anchorPattern);

      if (!anchors || anchors.length < 3) {
        recordDesignIssue(`需求 1.5: 期望找到 3 个计划锚点，实际找到 ${anchors?.length || 0} 个`);
      } else {
        console.log(`✓ 找到 ${anchors.length} 个计划锚点`);

        // 检查是否有双重锚点
        const doublePlanPattern = /<!--\s*plan:plan-\d+\s*-->\s*<!--\s*plan:p-[a-z0-9]+\s*-->/g;
        const doubleAnchors = panel2.match(doublePlanPattern);
        if (doubleAnchors && doubleAnchors.length > 0) {
          recordFunctionalIssue(`发现双重锚点: ${doubleAnchors.length} 个计划有两个锚点`);
          doubleAnchors.forEach(anchor => console.log(`  - ${anchor}`));
        }
      }
    });
  });

  describe('测试 2: EVR 格式验证 (需求 2)', () => {
    it('应该使用轻量版 EVR 规范的标签化条目格式', async () => {
      console.log('\n========== 开始测试 EVR 格式规范 ==========\n');

      // 创建任务
      await taskInitTool.handle({
        title: '实现文件上传',
        goal: '支持图片和文档上传功能',
        overall_plan: ['设计 API', '实现后端'],
      });

      // 添加 EVR
      console.log('\n>>> 创建 EVR');
      const modifyResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'API 接口正常响应',
              verify: 'curl -X POST /api/upload',
              expect: '返回 200 状态码和上传链接',
              class: 'runtime',
            },
            {
              title: '支持多种文件格式',
              verify: ['上传 .jpg 文件', '上传 .pdf 文件', '上传 .docx 文件'],
              expect: ['JPG 上传成功', 'PDF 上传成功', 'DOCX 上传成功'],
              class: 'static',
            }
          ]
        },
        reason: '添加验收标准',
        change_type: 'generate_steps',
      });

      const modifyResponse = JSON.parse(modifyResult.content[0].text);
      expect(modifyResponse.success).toBe(true);

      const panel = await readAndLogPanel('添加 EVR 后');

      // 需求 2.1: 验证 EVR 使用标签化条目格式
      console.log('\n>>> 验证需求 2.1: EVR 应该使用标签化条目格式');

      // 根据设计文档 line 148，应该是：
      // - [verify] <一句话说明如何验证>
      // - [expect] <一句话描述通过标准>
      // - [status] pass|fail|skip|unknown

      const evrSection = panel.match(/## Expected Visible Results([\s\S]*?)(?=\n##|$)/);
      if (!evrSection) {
        recordDesignIssue('需求 2.1: 面板中没有找到 Expected Visible Results 部分');
      } else {
        const evrContent = evrSection[1];
        console.log('EVR 部分内容:\n' + evrContent.substring(0, 500) + '...');

        // 检查标签化条目格式
        const verifyTag = evrContent.match(/^-\s+\[verify\]/gm);
        const expectTag = evrContent.match(/^-\s+\[expect\]/gm);
        const statusTag = evrContent.match(/^-\s+\[status\]/gm);

        console.log(`\n标签化条目检查:`);
        console.log(`  [verify] 标签: ${verifyTag?.length || 0} 个`);
        console.log(`  [expect] 标签: ${expectTag?.length || 0} 个`);
        console.log(`  [status] 标签: ${statusTag?.length || 0} 个`);

        if (!verifyTag || verifyTag.length === 0) {
          recordDesignIssue('需求 2.1: EVR 没有使用 "- [verify]" 标签化条目格式');

          // 检查是否使用了其他格式
          if (evrContent.includes('**Verify:**')) {
            recordDesignIssue('需求 2.1: EVR 使用了 "**Verify:**" 而非 "- [verify]"');
          }
        }

        if (!expectTag || expectTag.length === 0) {
          recordDesignIssue('需求 2.1: EVR 没有使用 "- [expect]" 标签化条目格式');

          if (evrContent.includes('**Expect:**')) {
            recordDesignIssue('需求 2.1: EVR 使用了 "**Expect:**" 而非 "- [expect]"');
          }
        }

        if (!statusTag || statusTag.length === 0) {
          recordDesignIssue('需求 2.1: EVR 没有使用 "- [status]" 标签化条目格式');

          if (evrContent.match(/^-\s+Status:/gm)) {
            recordDesignIssue('需求 2.1: EVR 使用了 "- Status:" 而非 "- [status]"');
          }
        }
      }

      // 需求 2.2: 验证 verify/expect 支持 string | string[]
      console.log('\n>>> 验证需求 2.2: verify/expect 支持数组格式');

      // 第二个 EVR 使用了数组格式，检查是否正确渲染
      const multiLineVerify = panel.match(/verify.*\n.*上传.*jpg.*\n.*上传.*pdf/i);
      if (!multiLineVerify) {
        recordFunctionalIssue('需求 2.2: verify 数组格式没有正确渲染为多行');
      }
    });
  });

  describe('测试 3: Lazy 同步详细验证 (需求 3)', () => {
    it('应该在工具调用前自动同步面板编辑', async () => {
      console.log('\n========== 开始测试 Lazy 同步机制 ==========\n');

      // 创建任务
      await taskInitTool.handle({
        title: '优化数据库查询',
        goal: '减少查询时间，提升性能',
        overall_plan: ['分析慢查询', '添加索引', '优化代码'],
      });

      await readAndLogPanel('初始任务');

      // 需求 3.1: 编辑计划文本
      console.log('\n>>> 测试需求 3.1: 自动同步计划文本修改');

      await editPanel(content => {
        return content.replace(
          /1\.\s+\[\s\]\s+分析慢查询/,
          '1. [ ] 分析慢查询并生成报告'
        );
      });

      console.log('✏️ 已手动编辑面板：修改计划 1 的文本');

      // 调用 read 触发同步
      const readResult1 = await taskReadTool.handle({ evr: { include: true } });
      const readResponse1 = JSON.parse(readResult1.content[0].text);

      await readAndLogPanel('read 调用后');

      // 需求 3.5: 验证返回 sync_preview
      console.log('\n>>> 验证需求 3.5: 返回 sync_preview');

      if (readResponse1.panel_pending) {
        console.log('✓ panel_pending = true');

        if (readResponse1.sync_preview) {
          console.log('✓ 返回了 sync_preview');
          console.log('sync_preview 内容:', JSON.stringify(readResponse1.sync_preview, null, 2));

          // 需求 7.3: read 应该返回 applied=false
          if (readResponse1.sync_preview.applied === false) {
            console.log('✓ read 模式下 applied=false（预览模式）');
          } else {
            recordFunctionalIssue('需求 7.3: read 应该返回 applied=false，实际为 ' + readResponse1.sync_preview.applied);
          }

          // 检查 changes 是否包含我们的修改
          if (readResponse1.sync_preview.changes && readResponse1.sync_preview.changes.length > 0) {
            console.log(`✓ 检测到 ${readResponse1.sync_preview.changes.length} 个变更`);

            const textChange = readResponse1.sync_preview.changes.find(
              (c: any) => c.field === 'description' || c.field === 'text'
            );

            if (textChange) {
              console.log('✓ 检测到计划文本变更');
            } else {
              recordFunctionalIssue('需求 3.1: 未检测到计划文本变更');
            }
          } else {
            recordFunctionalIssue('需求 3.1: sync_preview.changes 为空，未检测到任何变更');
          }
        } else {
          recordFunctionalIssue('需求 3.5: panel_pending=true 但没有返回 sync_preview');
        }
      } else {
        console.log('⚠️ panel_pending = false，可能未检测到面板修改');

        // 检查任务数据是否已更新
        const plan1 = readResponse1.task.overall_plan[0];
        const plan1Text = plan1.description || plan1.text;

        if (plan1Text.includes('生成报告')) {
          console.log('✓ 计划文本已更新（可能通过其他方式同步）');
        } else {
          recordFunctionalIssue('需求 3.1: 计划文本未同步，也未返回 sync_preview');
          console.log('期望包含: "生成报告"');
          console.log('实际内容:', plan1Text);
        }
      }

      // 需求 3.1: 再次调用 modify 应用变更
      console.log('\n>>> 测试通过 modify 应用变更');

      const modifyResult = await taskModifyTool.handle({
        field: 'plan',
        plan_no: 1,
        op: 'update',
        content: '分析慢查询并生成报告',
        reason: '应用面板编辑',
        change_type: 'user_request',
      });

      const modifyResponse = JSON.parse(modifyResult.content[0].text);

      if (modifyResponse.sync_preview) {
        console.log('modify 也返回了 sync_preview:', modifyResponse.sync_preview.applied);

        if (modifyResponse.sync_preview.applied === true) {
          console.log('✓ modify 模式下 applied=true（已应用）');
        } else {
          recordFunctionalIssue('modify 应该应用变更，但 applied=' + modifyResponse.sync_preview.applied);
        }
      }

      // 验证变更已持久化
      const readResult2 = await taskReadTool.handle({});
      const readResponse2 = JSON.parse(readResult2.content[0].text);

      const plan1After = readResponse2.task.overall_plan[0];
      const plan1TextAfter = plan1After.description || plan1After.text;

      if (plan1TextAfter.includes('生成报告')) {
        console.log('✓ 变更已持久化到任务数据');
      } else {
        recordFunctionalIssue('需求 3.1: modify 后变更仍未持久化');
      }
    });

    it('应该区分内容变更和状态变更 (需求 3.3)', async () => {
      console.log('\n========== 测试状态变更隔离 ==========\n');

      await taskInitTool.handle({
        title: '测试状态隔离',
        goal: '验证状态变更不会自动同步',
        overall_plan: ['步骤 1', '步骤 2'],
      });

      // 手动修改状态
      await editPanel(content => {
        return content.replace(
          /1\.\s+\[\s\]\s+步骤 1/,
          '1. [x] 步骤 1'
        );
      });

      console.log('✏️ 已手动编辑：将步骤 1 标记为已完成');

      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      await readAndLogPanel('状态编辑后 read');

      // 需求 3.3: 验证状态变更被识别为待定
      if (readResponse.sync_preview && readResponse.sync_preview.changes) {
        const statusChanges = readResponse.sync_preview.changes.filter(
          (c: any) => c.type === 'status'
        );

        console.log(`检测到的状态变更: ${statusChanges.length} 个`);

        if (statusChanges.length > 0) {
          console.log('✓ 状态变更被识别');

          // 验证状态变更未自动应用
          const plan1 = readResponse.task.overall_plan[0];
          if (plan1.status === 'completed') {
            recordFunctionalIssue('需求 3.3: 状态变更被自动应用了，应该保持为待定');
          } else {
            console.log('✓ 状态变更未自动应用（保持为待定）');
          }
        } else {
          recordFunctionalIssue('需求 3.3: 未检测到状态变更');
        }
      }
    });
  });

  describe('测试 4: EVR 更新和验证 (需求 2.5, 6)', () => {
    it('应该正确更新 EVR 状态并进行门槛检查', async () => {
      console.log('\n========== 测试 EVR 更新和门槛检查 ==========\n');

      await taskInitTool.handle({
        title: 'EVR 测试任务',
        goal: '验证 EVR 更新和门槛检查功能',
        overall_plan: ['计划 1', '计划 2'],
      });

      // 添加 EVR
      const modifyResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: '单元测试通过',
              verify: 'npm test',
              expect: '所有测试用例通过',
            }
          ]
        },
        reason: '添加 EVR',
        change_type: 'generate_steps',
      });

      expect(JSON.parse(modifyResult.content[0].text).success).toBe(true);

      let panel = await readAndLogPanel('添加 EVR 后');

      // 开始执行计划 1
      const updateResult1 = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'in_progress',
      });

      const updateResponse1 = JSON.parse(updateResult1.content[0].text);

      // 需求 2.4: 验证返回 evr_for_node
      console.log('\n>>> 验证需求 2.4: 计划切换到 in_progress 时返回 evr_for_node');

      if (updateResponse1.evr_for_node) {
        console.log(`✓ 返回了 evr_for_node: ${JSON.stringify(updateResponse1.evr_for_node)}`);

        if (updateResponse1.evr_for_node.length > 0) {
          console.log('✓ evr_for_node 包含该计划绑定的 EVR');
        } else {
          recordFunctionalIssue('需求 2.4: evr_for_node 为空数组');
        }
      } else {
        recordFunctionalIssue('需求 2.4: 未返回 evr_for_node 字段');
      }

      panel = await readAndLogPanel('计划切换到 in_progress');

      // 获取 EVR ID
      const readResult = await taskReadTool.handle({ evr: { include: true } });
      const readResponse = JSON.parse(readResult.content[0].text);

      const evrId = readResponse.evr_details[0]?.evr_id;
      if (!evrId) {
        recordFunctionalIssue('无法获取 EVR ID');
        return;
      }

      // 需求 2.5: 更新 EVR 状态
      console.log('\n>>> 验证需求 2.5: 更新 EVR 状态');

      const updateEVRResult = await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [{
            evr_id: evrId,
            status: 'pass',
            last_run: new Date().toISOString(),
            notes: '测试通过',
            proof: 'All tests passed',
          }]
        }
      });

      const updateEVRResponse = JSON.parse(updateEVRResult.content[0].text);

      if (updateEVRResponse.success) {
        console.log('✓ EVR 状态更新成功');
      } else {
        recordFunctionalIssue('需求 2.5: EVR 状态更新失败');
      }

      // 需求 8.1: 验证日志高亮
      console.log('\n>>> 验证需求 8.1: EVR 验证应该生成日志高亮');

      if (updateEVRResponse.logs_highlights) {
        console.log(`✓ 返回了 logs_highlights: ${updateEVRResponse.logs_highlights.length} 条`);

        const testLog = updateEVRResponse.logs_highlights.find(
          (log: any) => log.category === 'TEST'
        );

        if (testLog) {
          console.log('✓ 找到 TEST 类别的日志');
          console.log('  日志内容:', testLog.message);
        } else {
          recordFunctionalIssue('需求 8.1: logs_highlights 中没有 TEST 类别的日志');
        }
      } else {
        recordFunctionalIssue('需求 8.1: 未返回 logs_highlights');
      }

      panel = await readAndLogPanel('EVR 更新后');

      // 检查面板中的 EVR 状态
      if (panel.includes('[status]') && panel.includes('pass')) {
        console.log('✓ 面板中的 EVR 状态已更新为 pass');
      } else if (panel.includes('Status:') && panel.includes('pass')) {
        console.log('⚠️ 面板中的 EVR 状态已更新，但格式是 "Status:" 而非 "[status]"');
      } else {
        recordFunctionalIssue('面板中的 EVR 状态未更新');
      }

      // 需求 6.1: 验证计划门槛检查
      console.log('\n>>> 验证需求 6.1: 计划级 EVR 门槛检查');

      const updateResult2 = await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'completed',
      });

      const updateResponse2 = JSON.parse(updateResult2.content[0].text);

      if (updateResponse2.success) {
        console.log('✓ 计划完成成功（EVR 已就绪）');
      } else {
        recordFunctionalIssue('需求 6.1: 计划完成失败，但 EVR 应该已就绪');
      }
    });

    it('应该验证 skip 状态需要理由 (需求 6.3)', async () => {
      console.log('\n========== 测试 skip 状态理由验证 ==========\n');

      await taskInitTool.handle({
        title: 'Skip 理由测试',
        goal: '验证 skip 状态必须提供理由',
        overall_plan: ['计划 1'],
      });

      // 添加 EVR
      await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [{
            title: '性能测试',
            verify: '运行性能测试',
            expect: 'P95 < 200ms',
          }]
        },
        reason: '添加 EVR',
        change_type: 'generate_steps',
      });

      const readResult = await taskReadTool.handle({ evr: { include: true } });
      const readResponse = JSON.parse(readResult.content[0].text);
      const evrId = readResponse.evr_details[0]?.evr_id;

      // 尝试设置 skip 但不提供理由
      await taskUpdateTool.handle({
        update_type: 'evr',
        evr: {
          items: [{
            evr_id: evrId,
            status: 'skip',
            last_run: new Date().toISOString(),
            // 故意不提供 notes
          }]
        }
      });

      // 完成所有计划
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'in_progress',
      });
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'completed',
      });

      // 尝试完成任务
      const completeResult = await taskCompleteTool.handle({
        summary: '任务完成',
        generate_docs: false,
      });

      const completeResponse = JSON.parse(completeResult.content[0].text);

      console.log('\n>>> 验证需求 6.3: skip 状态需要理由');

      if (!completeResponse.success) {
        console.log('✓ 任务完成被阻止（符合预期）');

        if (completeResponse.evr_required_final) {
          const skipWithoutReason = completeResponse.evr_required_final.find(
            (e: any) => e.reason === 'need_reason_for_skip'
          );

          if (skipWithoutReason) {
            console.log('✓ 正确识别出 skip 状态缺少理由');
          } else {
            recordFunctionalIssue('需求 6.3: 未正确识别 skip 状态缺少理由');
          }
        }
      } else {
        recordFunctionalIssue('需求 6.3: skip 状态没有理由仍然允许完成任务');
      }
    });
  });

  describe('测试 5: modify 操作类型验证 (op 参数)', () => {
    it('应该正确处理 plan 的 append 操作', async () => {
      console.log('\n========== 测试 plan append 操作 ==========\n');

      // 创建初始任务，包含2个计划
      await taskInitTool.handle({
        title: '测试 append 操作',
        goal: '验证 append 不会删除现有内容',
        overall_plan: ['初始计划 1', '初始计划 2'],
      });

      await readAndLogPanel('初始任务创建');

      // 使用 append 追加新计划
      console.log('\n>>> 使用 op=append 追加计划 3');
      const appendResult = await taskModifyTool.handle({
        field: 'plan',
        op: 'append',
        content: ['新增计划 3'],
        reason: '测试 append 操作',
        change_type: 'plan_adjustment',
      });

      const appendResponse = JSON.parse(appendResult.content[0].text);
      expect(appendResponse.success).toBe(true);

      await readAndLogPanel('append 后');

      // 读取任务验证
      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      console.log('\n>>> 验证 append 结果');
      console.log(`计划总数: ${readResponse.task.overall_plan.length}`);

      if (readResponse.task.overall_plan.length === 3) {
        console.log('✓ append 成功：保留了原有2个计划，新增了1个');
        console.log(`  计划1: ${readResponse.task.overall_plan[0].description || readResponse.task.overall_plan[0].text}`);
        console.log(`  计划2: ${readResponse.task.overall_plan[1].description || readResponse.task.overall_plan[1].text}`);
        console.log(`  计划3: ${readResponse.task.overall_plan[2].description || readResponse.task.overall_plan[2].text}`);
      } else {
        recordFunctionalIssue(`append 操作失败: 期望3个计划，实际${readResponse.task.overall_plan.length}个`);
      }

      // 验证内容是否正确
      const plan1Text = readResponse.task.overall_plan[0]?.description || readResponse.task.overall_plan[0]?.text;
      const plan3Text = readResponse.task.overall_plan[2]?.description || readResponse.task.overall_plan[2]?.text;

      if (!plan1Text?.includes('初始计划 1')) {
        recordFunctionalIssue('append 操作错误: 原有计划1的内容丢失或被修改');
      }
      if (!plan3Text?.includes('新增计划 3')) {
        recordFunctionalIssue('append 操作错误: 新增计划3的内容不正确');
      }
    });

    it('应该正确处理 plan 的 insert 操作', async () => {
      console.log('\n========== 测试 plan insert 操作 ==========\n');

      await taskInitTool.handle({
        title: '测试 insert 操作',
        goal: '验证 insert 可以在指定位置插入',
        overall_plan: ['计划 1', '计划 3'],
      });

      // 在位置2插入新计划
      console.log('\n>>> 使用 op=insert 在位置2插入计划');
      const insertResult = await taskModifyTool.handle({
        field: 'plan',
        op: 'insert',
        plan_no: 2,
        content: ['计划 2'],
        reason: '在中间插入计划',
        change_type: 'plan_adjustment',
      });

      const insertResponse = JSON.parse(insertResult.content[0].text);
      expect(insertResponse.success).toBe(true);

      await readAndLogPanel('insert 后');

      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      console.log('\n>>> 验证 insert 结果');
      if (readResponse.task.overall_plan.length === 3) {
        const plan2Text = readResponse.task.overall_plan[1]?.description || readResponse.task.overall_plan[1]?.text;
        if (plan2Text?.includes('计划 2')) {
          console.log('✓ insert 成功：在位置2插入了新计划');
        } else {
          recordFunctionalIssue('insert 操作错误: 插入位置或内容不正确');
        }
      } else {
        recordFunctionalIssue(`insert 操作失败: 期望3个计划，实际${readResponse.task.overall_plan.length}个`);
      }
    });

    it('应该正确处理 plan 的 remove 操作', async () => {
      console.log('\n========== 测试 plan remove 操作 ==========\n');

      await taskInitTool.handle({
        title: '测试 remove 操作',
        goal: '验证 remove 可以删除指定计划',
        overall_plan: ['计划 1', '计划 2', '计划 3'],
      });

      console.log('\n>>> 使用 op=remove 删除计划2');
      const removeResult = await taskModifyTool.handle({
        field: 'plan',
        op: 'remove',
        plan_no: 2,
        reason: '删除中间的计划',
        change_type: 'plan_adjustment',
      });

      const removeResponse = JSON.parse(removeResult.content[0].text);
      expect(removeResponse.success).toBe(true);

      await readAndLogPanel('remove 后');

      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      console.log('\n>>> 验证 remove 结果');
      if (readResponse.task.overall_plan.length === 2) {
        const texts = readResponse.task.overall_plan.map((p: any) => p.description || p.text);
        if (texts.some((t: string) => t.includes('计划 1')) &&
            texts.some((t: string) => t.includes('计划 3')) &&
            !texts.some((t: string) => t.includes('计划 2'))) {
          console.log('✓ remove 成功：删除了计划2，保留了计划1和3');
        } else {
          recordFunctionalIssue('remove 操作错误: 删除的不是指定计划');
        }
      } else {
        recordFunctionalIssue(`remove 操作失败: 期望2个计划，实际${readResponse.task.overall_plan.length}个`);
      }
    });

    it('应该正确处理 steps 的 append 操作', async () => {
      console.log('\n========== 测试 steps append 操作 ==========\n');

      await taskInitTool.handle({
        title: '测试 steps append',
        goal: '验证步骤的 append 操作',
        overall_plan: ['计划 1'],
      });

      // 先添加初始步骤
      await taskModifyTool.handle({
        field: 'steps',
        plan_no: 1,
        op: 'replace',
        content: ['步骤 1', '步骤 2'],
        reason: '添加初始步骤',
        change_type: 'generate_steps',
      });

      console.log('\n>>> 使用 op=append 追加步骤3');
      const appendResult = await taskModifyTool.handle({
        field: 'steps',
        plan_no: 1,
        op: 'append',
        content: ['步骤 3'],
        reason: '追加新步骤',
        change_type: 'steps_adjustment',
      });

      const appendResponse = JSON.parse(appendResult.content[0].text);
      expect(appendResponse.success).toBe(true);

      await readAndLogPanel('steps append 后');

      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      const plan1 = readResponse.task.overall_plan[0];
      console.log('\n>>> 验证 steps append 结果');
      console.log(`步骤总数: ${plan1.steps.length}`);

      if (plan1.steps.length === 3) {
        console.log('✓ steps append 成功：保留了原有2个步骤，新增了1个');
      } else {
        recordFunctionalIssue(`steps append 失败: 期望3个步骤，实际${plan1.steps.length}个`);
      }
    });

    it('应该正确处理 hints 的 append 操作', async () => {
      console.log('\n========== 测试 hints append 操作 ==========\n');

      await taskInitTool.handle({
        title: '测试 hints append',
        goal: '验证 hints 的 append 操作',
        overall_plan: ['计划 1'],
      });

      // 先设置初始提示
      await taskModifyTool.handle({
        field: 'goal',
        op: 'replace',
        content: '目标内容',
        hints: ['提示 1', '提示 2'],
        reason: '添加初始提示',
        change_type: 'user_request',
      });

      console.log('\n>>> 使用 hints 参数追加新提示');
      // 注意：根据设计，hints 作为通用参数，应该支持追加
      // 但当前实现中 modifyHints 直接替换了整个数组
      const appendResult = await taskModifyTool.handle({
        field: 'hints',
        op: 'append',
        content: [],
        hints: ['提示 3'],
        reason: '追加提示',
        change_type: 'user_request',
      });

      const appendResponse = JSON.parse(appendResult.content[0].text);
      expect(appendResponse.success).toBe(true);

      await readAndLogPanel('hints append 后');

      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);

      console.log('\n>>> 验证 hints append 结果');
      console.log(`提示总数: ${readResponse.task.task_hints?.length || 0}`);

      if (readResponse.task.task_hints?.length === 3) {
        console.log('✓ hints append 成功：保留了原有2个提示，新增了1个');
      } else {
        recordFunctionalIssue(`hints append 失败: 期望3个提示，实际${readResponse.task.task_hints?.length || 0}个`);
      }
    });

    it('应该正确处理 evr 的 add/update/remove 操作', async () => {
      console.log('\n========== 测试 evr 操作 ==========\n');

      await taskInitTool.handle({
        title: '测试 EVR 操作',
        goal: '验证 EVR 的 add/update/remove',
        overall_plan: ['计划 1'],
      });

      // 测试 add
      console.log('\n>>> 测试 op=add 添加 EVR');
      const addResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [
            {
              title: 'EVR 1',
              verify: '验证方法 1',
              expect: '预期结果 1',
            },
            {
              title: 'EVR 2',
              verify: '验证方法 2',
              expect: '预期结果 2',
            }
          ]
        },
        reason: '添加 EVR',
        change_type: 'generate_steps',
      });

      expect(JSON.parse(addResult.content[0].text).success).toBe(true);
      await readAndLogPanel('EVR add 后');

      let readResult = await taskReadTool.handle({ evr: { include: true } });
      let readResponse = JSON.parse(readResult.content[0].text);

      if (readResponse.evr_details.length === 2) {
        console.log('✓ EVR add 成功：添加了2个 EVR');
      } else {
        recordFunctionalIssue(`EVR add 失败: 期望2个 EVR，实际${readResponse.evr_details.length}个`);
      }

      const evr1Id = readResponse.evr_details[0]?.evr_id;

      // 测试 update
      console.log('\n>>> 测试 op=update 更新 EVR 内容');
      const updateResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'update',
        evr: {
          items: [{
            evrId: evr1Id,
            title: 'EVR 1 已更新',
            verify: '新的验证方法',
          }]
        },
        reason: '更新 EVR 内容',
        change_type: 'refine_goal',
      });

      expect(JSON.parse(updateResult.content[0].text).success).toBe(true);
      await readAndLogPanel('EVR update 后');

      readResult = await taskReadTool.handle({ evr: { include: true } });
      readResponse = JSON.parse(readResult.content[0].text);

      const updatedEvr = readResponse.evr_details.find((e: any) => e.evr_id === evr1Id);
      if (updatedEvr?.title === 'EVR 1 已更新') {
        console.log('✓ EVR update 成功：内容已更新');
      } else {
        recordFunctionalIssue('EVR update 失败: 内容未更新');
      }

      // 测试 remove
      console.log('\n>>> 测试 op=remove 删除 EVR');
      const removeResult = await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'remove',
        evr: {
          evrIds: [evr1Id]
        },
        reason: '删除 EVR',
        change_type: 'scope_change',
      });

      expect(JSON.parse(removeResult.content[0].text).success).toBe(true);
      await readAndLogPanel('EVR remove 后');

      readResult = await taskReadTool.handle({ evr: { include: true } });
      readResponse = JSON.parse(readResult.content[0].text);

      if (readResponse.evr_details.length === 1) {
        console.log('✓ EVR remove 成功：删除了1个 EVR，剩余1个');
      } else {
        recordFunctionalIssue(`EVR remove 失败: 期望剩余1个 EVR，实际${readResponse.evr_details.length}个`);
      }
    });
  });

  describe('测试 6: 完整工作流集成', () => {
    it('应该支持完整的任务生命周期', async () => {
      console.log('\n========== 完整工作流测试 ==========\n');

      // 1. 握手
      const infoResult = await projectInfoTool.handle();
      const infoResponse = JSON.parse(infoResult.content[0].text);
      expect(infoResponse.data.connected).toBe(true);
      console.log('✓ 项目已连接');

      // 2. 创建任务
      await taskInitTool.handle({
        title: '完整流程测试',
        goal: '验证从创建到完成的完整任务流程',
        overall_plan: ['阶段 1', '阶段 2'],
      });
      console.log('✓ 任务已创建');

      await readAndLogPanel('步骤 2: 任务创建');

      // 3. 添加 EVR
      await taskModifyTool.handle({
        field: 'evr',
        plan_no: 1,
        op: 'add',
        evr: {
          items: [{
            title: '功能验证',
            verify: '手动测试功能',
            expect: '功能正常运行',
          }]
        },
        reason: '添加验收标准',
        change_type: 'generate_steps',
      });
      console.log('✓ EVR 已添加');

      await readAndLogPanel('步骤 3: EVR 添加');

      // 4. 手动编辑面板
      await editPanel(content => {
        return content.replace('阶段 1', '阶段 1：需求分析');
      });
      console.log('✓ 面板已编辑');

      // 5. 读取触发同步
      const readResult = await taskReadTool.handle({});
      const readResponse = JSON.parse(readResult.content[0].text);
      console.log(`✓ 读取任务，panel_pending=${readResponse.panel_pending || false}`);

      await readAndLogPanel('步骤 5: 读取后');

      // 6. 执行计划
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'in_progress',
      });
      console.log('✓ 计划 1 进行中');

      await readAndLogPanel('步骤 6: 计划执行');

      // 7. 更新 EVR
      const evrId = readResponse.evr_details[0]?.evr_id;
      if (evrId) {
        await taskUpdateTool.handle({
          update_type: 'evr',
          evr: {
            items: [{
              evr_id: evrId,
              status: 'pass',
              last_run: new Date().toISOString(),
              notes: '验证通过',
            }]
          }
        });
        console.log('✓ EVR 已验证');
      }

      await readAndLogPanel('步骤 7: EVR 验证');

      // 8. 完成计划
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 1,
        status: 'completed',
      });
      console.log('✓ 计划 1 已完成');

      // 9. 完成第二个计划
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 2,
        status: 'in_progress',
      });
      await taskUpdateTool.handle({
        update_type: 'plan',
        plan_no: 2,
        status: 'completed',
      });
      console.log('✓ 计划 2 已完成');

      await readAndLogPanel('步骤 9: 所有计划完成');

      // 10. 完成任务
      const completeResult = await taskCompleteTool.handle({
        summary: '任务已完成',
        generate_docs: true,
      });

      const completeResponse = JSON.parse(completeResult.content[0].text);
      console.log(`✓ 任务完成: success=${completeResponse.success}`);

      if (completeResponse.success) {
        console.log('\n✅ 完整工作流测试通过');
      } else {
        recordFunctionalIssue('完整工作流: 任务完成失败 - ' + JSON.stringify(completeResponse));
      }
    });
  });
});
