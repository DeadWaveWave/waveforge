import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectManager } from '../src/core/project-manager.js';
import { TaskManager } from '../src/core/task-manager.js';
import { ConnectProjectTool } from '../src/tools/handshake-tools.js';
import { CurrentTaskInitTool } from '../src/tools/task-tools.js';

async function main() {
  const base = path.join(process.cwd(), 'test-temp', 'e2e-smoke');
  const projectDir = path.join(base, 'my-project');
  await fs.remove(base).catch(() => {});
  await fs.ensureDir(projectDir);

  const projectManager = new ProjectManager();
  const taskManager = new TaskManager(path.join(projectDir, '.wave'), projectManager);

  const connect = new ConnectProjectTool(projectManager, taskManager);
  const res = await connect.handle({ project_path: projectDir });
  const conn = JSON.parse(res.content[0].text);
  if (!conn.success || !conn.data.connected) {
    console.error('Connect failed:', conn);
    process.exit(1);
  }

  const init = new CurrentTaskInitTool(taskManager);
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

  // Also verify multi-task directory
  const tasksDir = path.join(waveDir, 'tasks');
  const hasTasksDir = await fs.pathExists(tasksDir);
  let taskSubDirCount = 0;
  if (hasTasksDir) {
    const years = (await fs.readdir(tasksDir)).filter(async (y) => (await fs.stat(path.join(tasksDir, y))).isDirectory());
    // Best-effort: count nested directories
    taskSubDirCount = (await fs.readdir(tasksDir)).length;
  }

  console.log(JSON.stringify({
    projectDir,
    waveDir,
    exists,
    hasTasksDir,
    taskSubDirCount,
  }, null, 2));
}

main().catch((e) => {
  console.error('E2E smoke failed:', e);
  process.exit(1);
});

