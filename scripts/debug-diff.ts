import { createPanelRenderer } from '../src/core/panel-renderer.js';
import { createLazySync } from '../src/core/lazy-sync.js';

async function run() {
  const renderer = createPanelRenderer();
  const lazy = createLazySync();

  const taskData: any = {
    id: 't1',
    title: '原始任务标题',
    goal: '测试面板编辑自动同步功能',
    requirements: ['测试面板编辑自动同步功能'],
    issues: [],
    hints: [],
    plans: [
      { id: 'plan-1', description: '计划 1', status: 'to_do', hints: [], steps: [] },
      { id: 'plan-2', description: '计划 2', status: 'to_do', hints: [], steps: [] },
    ],
    expectedResults: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const panelData: any = {
    title: taskData.title,
    taskId: taskData.id,
    references: [],
    requirements: taskData.requirements,
    issues: [],
    hints: [],
    plans: taskData.plans.map((p: any, idx: number) => ({
      id: p.id,
      anchor: p.id,
      text: p.description,
      status: p.status,
      hints: [],
      contextTags: [],
      evrBindings: [],
      steps: [],
    })),
    evrs: [],
    logs: [],
    metadata: { createdAt: taskData.createdAt, updatedAt: taskData.updatedAt },
  };

  const md = renderer.renderToMarkdown(panelData);
  const modified = md.replace('原始任务标题', '用户手改的任务标题');

  const diff = lazy.detectDifferences(modified, taskData);
  console.log('contentChanges:', diff.contentChanges.length, 'statusChanges:', diff.statusChanges.length);
  if (diff.contentChanges.length) {
    console.log('First change:', diff.contentChanges[0]);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

