import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectManager } from '../dist/esm/core/project-manager.js';
import { TaskManager } from '../dist/esm/core/task-manager.js';
import { ConnectProjectTool } from '../dist/esm/tools/handshake-tools.js';
import { CurrentTaskInitTool } from '../dist/esm/tools/task-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const base = path.join(process.cwd(), 'test-temp', 'e2e-smoke-js');
  const projectDir = path.join(base, 'my-project');
  await fs.remove(base).catch(() => {});
  await fs.ensureDir(projectDir);

  const pm = new ProjectManager();
  const tm = new TaskManager(path.join(projectDir, '.wave'), pm);

  const connect = new ConnectProjectTool(pm, tm);
  const res = await connect.handle({ project_path: projectDir });
  const conn = JSON.parse(res.content[0].text);
  if (!conn.success || !conn.data.connected) {
    console.error('Connect failed:', conn);
    process.exit(1);
  }

  const init = new CurrentTaskInitTool(tm);
  const initRes = await init.handle({
    title: 'E2E Smoke Task',
    goal: 'Ensure docs land under connected project .wave',
    overall_plan: [],
    knowledge_refs: [],
  });
  const initPayload = JSON.parse(initRes.content[0].text);
  if (!initPayload.success) {
    console.error('Init task failed:', initPayload);
    process.exit(1);
  }

  const waveDir = path.join(projectDir, '.wave');
  const jsonPath = path.join(waveDir, 'current-task.json');
  const mdPath = path.join(waveDir, 'current-task.md');

  const exists = {
    waveDir: await fs.pathExists(waveDir),
    currentTaskJson: await fs.pathExists(jsonPath),
    currentTaskMd: await fs.pathExists(mdPath),
  };

  const tasksDir = path.join(waveDir, 'tasks');
  const hasTasksDir = await fs.pathExists(tasksDir);

  console.log(JSON.stringify({ projectDir, waveDir, exists, hasTasksDir }, null, 2));
}

main().catch((e) => {
  console.error('E2E smoke failed:', e);
  process.exit(1);
});

