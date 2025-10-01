/**
 * 测试新的面板格式是否符合设计文档
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from './src/core/project-manager.js';
import { TaskManager } from './src/core/task-manager.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('新面板格式验证', () => {
    let tempDir: string;
    let taskManager: TaskManager;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panel-format-test-'));
        const projectManager = new ProjectManager();
        taskManager = new TaskManager(path.join(tempDir, '.wave'), projectManager);

        const testProjectPath = path.join(tempDir, 'test-project');
        await fs.ensureDir(testProjectPath);
        await projectManager.bindProject({ project_path: testProjectPath });
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    it('应该生成符合设计文档的面板格式', async () => {
        // 创建任务
        await taskManager.initTask({
            title: '统一 Alembic 迁移管理',
            goal: '所有数据库变更都通过 Alembic 进行管理，这样我可以确保数据库状态的一致性和可追溯性',
            overall_plan: [
                '盘点与基线',
                '规范与模板统一',
                '替换运行期建表为部署前迁移',
            ],
            knowledge_refs: ['specs/alembic-migration-unification/requirements.md'],
        });

        // 读取生成的面板
        const panelPath = path.join(tempDir, '.wave', 'current-task.md');
        const panelContent = await fs.readFile(panelPath, 'utf8');

        console.log('\n=== 生成的面板格式 ===\n');
        console.log(panelContent);
        console.log('\n=== 格式检查 ===\n');

        // 验证格式符合设计文档
        expect(panelContent).toContain('# 统一 Alembic 迁移管理');
        expect(panelContent).toContain('## Requirements');
        expect(panelContent).toContain('## Plans & Steps');

        // 验证复选框格式（不应该有 emoji）
        expect(panelContent).toContain('[ ]'); // to_do 状态
        expect(panelContent).not.toContain('✅'); // 不应该有 emoji
        expect(panelContent).not.toContain('🔄');
        expect(panelContent).not.toContain('⏳');

        console.log('✅ 标题格式正确');
        console.log('✅ 包含 Requirements 章节');
        console.log('✅ 包含 Plans & Steps 章节');
        console.log('✅ 使用复选框格式而非 emoji');
    });
});

