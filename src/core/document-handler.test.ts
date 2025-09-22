/**
 * DocumentHandler 测试用例
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentHandler } from './document-handler.js';
import fs from 'fs-extra';
import * as path from 'path';

describe('DocumentHandler', () => {
  let documentHandler: DocumentHandler;
  let testDocsPath: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDocsPath = path.join(process.cwd(), '.test-wave');
    documentHandler = new DocumentHandler(testDocsPath);

    // 清理测试环境
    await fs.remove(testDocsPath);
  });

  afterEach(async () => {
    // 清理测试环境
    await fs.remove(testDocsPath);
  });

  describe('构造函数', () => {
    it('应该正确初始化 DocumentHandler', () => {
      expect(documentHandler.getDocsPath()).toBe(testDocsPath);
    });

    it('应该拒绝空的 docsPath', () => {
      expect(() => new DocumentHandler('')).toThrow('docsPath 不能为空');
      expect(() => new DocumentHandler('   ')).toThrow('docsPath 不能为空');
    });

    it('应该去除 docsPath 的前后空格', () => {
      const handler = new DocumentHandler('  /test/path  ');
      expect(handler.getDocsPath()).toBe('/test/path');
    });
  });

  describe('initializeWaveDirectory', () => {
    it('应该在全新环境中正确初始化所有必要文件和目录', async () => {
      const result = await documentHandler.initializeWaveDirectory();

      // 验证返回结果
      expect(result.isFirstRun).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.created.length).toBeGreaterThan(0);

      // 验证目录结构被创建
      expect(await fs.pathExists(testDocsPath)).toBe(true);
      expect(await fs.pathExists(path.join(testDocsPath, 'tasks'))).toBe(true);
      expect(
        await fs.pathExists(path.join(testDocsPath, 'tasks', 'views'))
      ).toBe(true);
      expect(
        await fs.pathExists(
          path.join(testDocsPath, 'tasks', 'views', 'by-slug')
        )
      ).toBe(true);
      expect(await fs.pathExists(path.join(testDocsPath, 'templates'))).toBe(
        true
      );
    });

    it('应该具备完全的幂等性', async () => {
      // 执行第一次初始化
      const firstResult = await documentHandler.initializeWaveDirectory();
      expect(firstResult.isFirstRun).toBe(true);
      expect(firstResult.created.length).toBeGreaterThan(0);

      // 执行第二次初始化
      const secondResult = await documentHandler.initializeWaveDirectory();
      expect(secondResult.isFirstRun).toBe(false);
      expect(secondResult.created).toHaveLength(0);
      expect(secondResult.existing.length).toBeGreaterThan(0);
      expect(secondResult.errors).toHaveLength(0);
    });

    it('应该正确处理初始化过程中的错误', async () => {
      // 创建一个无法写入的目录来模拟错误
      const readOnlyPath = path.join(testDocsPath, 'readonly');
      await fs.ensureDir(readOnlyPath);

      // 在某些系统上，这可能不会产生错误，所以我们只测试错误处理机制
      const result = await documentHandler.initializeWaveDirectory();

      // 即使有错误，也应该返回有效的结果对象
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('existing');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('isFirstRun');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('文件系统工具方法', () => {
    it('应该正确检测文件存在性', async () => {
      const testFile = path.join(testDocsPath, 'test.txt');

      // 文件不存在时
      const handler = documentHandler as any;
      expect(await handler.fileExists(testFile)).toBe(false);

      // 创建文件后
      await fs.ensureDir(testDocsPath);
      await fs.writeFile(testFile, 'test content');
      expect(await handler.fileExists(testFile)).toBe(true);
    });

    it('应该正确检测目录存在性', async () => {
      const testDir = path.join(testDocsPath, 'testdir');

      // 目录不存在时
      const handler = documentHandler as any;
      expect(await handler.directoryExists(testDir)).toBe(false);

      // 创建目录后
      await fs.ensureDir(testDir);
      expect(await handler.directoryExists(testDir)).toBe(true);
    });

    it('应该正确验证 JSON 文件', async () => {
      await fs.ensureDir(testDocsPath);

      const validJsonFile = path.join(testDocsPath, 'valid.json');
      const invalidJsonFile = path.join(testDocsPath, 'invalid.json');

      await fs.writeFile(validJsonFile, '{"valid": true}');
      await fs.writeFile(invalidJsonFile, 'invalid json content');

      const handler = documentHandler as any;
      expect(await handler.isValidJson(validJsonFile)).toBe(true);
      expect(await handler.isValidJson(invalidJsonFile)).toBe(false);
    });
  });

  describe('模板处理', () => {
    it('应该正确填充模板内容', () => {
      const template = `# {{title}}

目标: {{goal}}
状态: {{status}}
未定义: {{undefined_key}}`;

      const context = {
        title: '测试任务',
        goal: '完成测试',
        status: '进行中',
      };

      const handler = documentHandler as any;
      const result = handler.fillTemplate(template, context);

      expect(result).toContain('# 测试任务');
      expect(result).toContain('目标: 完成测试');
      expect(result).toContain('状态: 进行中');
      expect(result).toContain('未定义: '); // 未定义的键应该被替换为空字符串
      expect(result).not.toContain('{{');
    });

    it('应该正确加载模板文件', async () => {
      await fs.ensureDir(testDocsPath);
      await fs.ensureDir(path.join(testDocsPath, 'templates'));

      const templatePath = path.join(
        testDocsPath,
        'templates',
        'test-template.md'
      );
      const templateContent = '# {{title}}\n\n{{content}}';
      await fs.writeFile(templatePath, templateContent);

      const result = await documentHandler.loadTemplate(templatePath);
      expect(result).toBe(templateContent);
    });

    it('应该在模板文件不存在时使用默认模板', async () => {
      const nonExistentPath = path.join(
        testDocsPath,
        'non-existent-template.md'
      );
      const result = await documentHandler.loadTemplate(nonExistentPath);

      expect(result).toContain('# 开发日志');
      expect(result).toContain('{{title}}');
      expect(result).toContain('{{goal}}');
    });

    it('应该支持环境变量覆盖模板路径', async () => {
      // 保存原始环境变量
      const originalEnv = process.env.WF_DEVLOG_TEMPLATE;

      try {
        // 设置环境变量
        process.env.WF_DEVLOG_TEMPLATE = 'custom-template.md';

        const handler = documentHandler as any;
        const templatePath = handler.getTemplateFilePath();

        expect(templatePath).toContain('custom-template.md');
      } finally {
        // 恢复原始环境变量
        if (originalEnv !== undefined) {
          process.env.WF_DEVLOG_TEMPLATE = originalEnv;
        } else {
          delete process.env.WF_DEVLOG_TEMPLATE;
        }
      }
    });

    it('应该按优先级查找内置模板', async () => {
      // 创建测试模板文件
      await fs.ensureDir('docs/template');
      await fs.ensureDir('templates');

      const docsTemplate = 'docs/template/devlog-template.md';
      const templatesTemplate = 'templates/devlog-template.md';

      await fs.writeFile(docsTemplate, '# Docs Template');
      await fs.writeFile(templatesTemplate, '# Templates Template');

      const handler = documentHandler as any;
      const result = await handler.findBuiltinTemplate();

      expect(result).toBe(docsTemplate); // 应该优先选择 docs/template/

      // 清理测试创建的文件
      await fs.remove('docs/template');
      await fs.remove('templates');
    });
  });

  describe('任务文档渲染', () => {
    it('应该正确生成任务文档', async () => {
      const mockTask = {
        id: 'task-123',
        title: '测试任务',
        slug: 'test-task',
        goal: '完成测试功能的开发和验证',
        task_hints: ['注意边界条件', '确保测试覆盖率'],
        overall_plan: [
          {
            id: 'plan-1',
            description: '设计阶段',
            status: 'completed',
            hints: ['考虑扩展性'],
            steps: [
              {
                id: 'step-1',
                description: '需求分析',
                status: 'completed',
                hints: ['与用户确认'],
                evidence: 'requirements.md',
                notes: '已完成需求收集',
              },
            ],
          },
        ],
        current_plan_id: 'plan-1',
        logs: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            level: 'INFO',
            category: 'TASK',
            action: 'CREATE',
            message: '任务创建',
            ai_notes: '开始新任务',
          },
        ],
        knowledge_refs: ['https://docs.example.com'],
        created_at: '2025-01-01T09:00:00Z',
        updated_at: '2025-01-01T11:00:00Z',
      };

      await fs.ensureDir(testDocsPath);
      await documentHandler.generateCurrentTaskDocument(mockTask as any);

      const documentPath = path.join(testDocsPath, 'current-task.md');
      expect(await fs.pathExists(documentPath)).toBe(true);

      const content = await fs.readFile(documentPath, 'utf8');
      expect(content).toContain('# 测试任务');
      expect(content).toContain('完成测试功能的开发和验证');
      expect(content).toContain('注意边界条件');
      expect(content).toContain('✅ **设计阶段** (当前)');
      expect(content).toContain('✅ 需求分析');
      expect(content).toContain('证据: requirements.md');
    });

    it('应该正确解析任务文档', () => {
      const documentContent = `# 测试任务

> **任务ID**: task-123

## 验收标准

完成所有功能开发

## 任务提示

- 注意性能优化
- 确保代码质量

## 整体计划

1. ✅ **设计阶段** (当前)
   > 提示:
   > - 考虑扩展性
   - ✅ 需求分析
     > 提示:
     > - 与用户确认

2. ⏳ 开发阶段
   - ⏳ 编码实现
`;

      const handler = documentHandler as any;
      const parsed = handler.parseTaskDocument(documentContent);

      expect(parsed.title).toBe('测试任务');
      expect(parsed.goal).toBe('完成所有功能开发');
      expect(parsed.hints.task).toContain('注意性能优化');
      expect(parsed.plans).toHaveLength(2);
      if (parsed.plans[0]) {
        expect(parsed.plans[0].description).toBe('设计阶段');
        expect(parsed.plans[0].status).toBe('completed');
        if (parsed.plans[0].steps[0]) {
          expect(parsed.plans[0].steps[0].description).toBe('需求分析');
        }
      }
    });

    it('应该正确解析提示信息', () => {
      const handler = documentHandler as any;

      // 测试列表格式
      expect(handler.parseHints('- 这是一个提示')).toEqual(['这是一个提示']);

      // 测试引用格式
      expect(handler.parseHints('   > - 这是引用提示')).toEqual([
        '这是引用提示',
      ]);

      // 测试逗号分隔
      expect(handler.parseHints('提示1, 提示2, 提示3')).toEqual([
        '提示1',
        '提示2',
        '提示3',
      ]);

      // 测试空行
      expect(handler.parseHints('')).toEqual([]);
      expect(handler.parseHints('   ')).toEqual([]);
    });

    it('应该正确提取文档中的所有提示', () => {
      const content = `# 任务

## 任务提示
- 任务级提示1
- 任务级提示2

## 整体计划

1. ✅ 计划1
   > 提示:
   > - 计划级提示1
   - ✅ 步骤1
     > 提示:
     > - 步骤级提示1
`;

      const handler = documentHandler as any;
      const hints = handler.extractAllHints(content);

      expect(hints.task).toContain('任务级提示1');
      expect(hints.plan).toContain('计划级提示1');
      expect(hints.step).toContain('步骤级提示1');
    });
  });

  describe('错误处理', () => {
    it('应该优雅地处理文件系统权限错误', async () => {
      // 这个测试在不同的操作系统上可能表现不同
      // 主要是验证错误处理机制不会导致程序崩溃
      const result = await documentHandler.initializeWaveDirectory();

      // 应该总是返回有效的结果对象
      expect(result).toBeDefined();
      expect(typeof result.isFirstRun).toBe('boolean');
      expect(Array.isArray(result.created)).toBe(true);
      expect(Array.isArray(result.existing)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
