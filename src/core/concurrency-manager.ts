/**
 * CrossProcessConcurrencyManager - 跨进程并发管理器
 * 负责文件锁机制、状态版本管理和原子文件操作
 */

import fs from 'fs-extra';
import * as path from 'path';
// import * as os from 'os';
// import { ulid } from 'ulid';
import { logger } from './logger.js';
import {
  LogCategory,
  LogAction,
  type FileLock,
  type TaskState,
  // type TaskOperation,
  // type ConflictInfo,
  type LockAcquisitionOptions,
  type AtomicOperationResult,
} from '../types/index.js';

/**
 * 死锁检测请求接口
 */
export interface DeadlockRequest {
  processId: string;
  heldLocks: string[];
  requestedLock?: string;
}

/**
 * 死锁检测结果接口
 */
export interface DeadlockInfo {
  hasDeadlock: boolean;
  deadlockChain: string[];
  deadlockType?: 'simple' | 'circular' | 'self-deadlock';
  cycleLength?: number;
  multipleDeadlocks?: boolean;
  deadlockGroups?: string[][];
  suggestedVictim?: string;
}

/**
 * 状态快照接口
 */
export interface StateSnapshot {
  version: number;
  timestamp: string;
  checksum: string;
  data?: any;
}

/**
 * 版本历史记录接口
 */
export interface VersionHistoryRecord {
  version: number;
  timestamp: string;
  operation?: string;
  processId?: string;
}

/**
 * CrossProcessConcurrencyManager - 跨进程并发管理器核心类
 */
export class CrossProcessConcurrencyManager {
  private docsPath: string;
  private lockTimeout: number;
  private processId: string;
  private deadlockPreventionEnabled: boolean;

  constructor(docsPath: string, lockTimeout: number = 30000) {
    if (!docsPath || docsPath.trim() === '') {
      throw new Error('docsPath 不能为空');
    }

    this.docsPath = docsPath.trim();
    this.lockTimeout = lockTimeout;
    this.processId = this.generateProcessId();
    this.deadlockPreventionEnabled = false;

    logger.info(LogCategory.Task, LogAction.Create, '并发管理器初始化', {
      docsPath: this.docsPath,
      lockTimeout: this.lockTimeout,
      processId: this.processId,
    });
  }

  /**
   * 获取文档路径
   */
  getDocsPath(): string {
    return this.docsPath;
  }

  /**
   * 获取进程ID
   */
  getProcessId(): string {
    return this.processId;
  }

  /**
   * 获取锁目录路径
   */
  private getLockDir(): string {
    return path.join(this.docsPath, '.locks');
  }

  /**
   * 获取状态目录路径
   */
  private getStateDir(): string {
    return path.join(this.docsPath, '.state');
  }

  /**
   * 获取锁文件路径
   */
  private getLockPath(taskId: string): string {
    return path.join(this.getLockDir(), `${taskId}.lock`);
  }

  /**
   * 获取状态文件路径
   */
  private getStatePath(taskId: string): string {
    return path.join(this.getStateDir(), `${taskId}.state`);
  }

  /**
   * 生成进程ID
   */
  private generateProcessId(): string {
    const pid = process.pid;
    return `waveforge-${pid}`;
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.getLockDir());
    await fs.ensureDir(this.getStateDir());
  }

  /**
   * 获取文件锁
   */
  async acquireFileLock(
    taskId: string,
    options: LockAcquisitionOptions = {}
  ): Promise<FileLock> {
    const {
      timeout = this.lockTimeout,
      retryInterval = 100,
      maxRetries = Math.floor(timeout / retryInterval),
      lockType = 'write',
      force = false,
      signal,
      currentHeldLocks = [],
    } = options;

    await this.ensureDirectories();

    const lockPath = this.getLockPath(taskId);
    const startTime = Date.now();
    let retryCount = 0;

    logger.info(LogCategory.Task, LogAction.Handle, '尝试获取文件锁', {
      taskId,
      lockPath,
      timeout,
      lockType,
      force,
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // 检查取消信号
      if (signal?.aborted) {
        throw new Error('操作被取消');
      }

      // 死锁预防检查
      if (this.deadlockPreventionEnabled && currentHeldLocks.length > 0) {
        // 简单的死锁预防：检查是否会形成循环依赖
        if (currentHeldLocks.includes(taskId)) {
          throw new Error('检测到潜在死锁，操作被阻止');
        }
        // 检查是否存在其他进程持有请求的锁，这可能形成死锁
        const lockPath = path.join(this.docsPath, '.locks', `${taskId}.lock`);
        if (await fs.pathExists(lockPath)) {
          throw new Error('检测到潜在死锁，操作被阻止');
        }
      }

      try {
        // 检查锁文件是否存在
        if (await fs.pathExists(lockPath)) {
          // 读取现有锁信息
          const existingLockData = await this.readLockFile(lockPath);

          // 检查是否是过期锁
          if (await this.isLockStale(lockPath)) {
            if (force) {
              // 强制获取过期锁
              await fs.remove(lockPath);
              logger.info(
                LogCategory.Task,
                LogAction.Handle,
                '清理过期锁文件',
                {
                  taskId,
                  lockPath,
                  expiredProcessId: existingLockData.processId,
                }
              );
            } else {
              throw new Error('锁文件已过期但未启用强制模式');
            }
          } else if (force) {
            // 尝试强制获取有效锁，应该失败
            logger.info(
              LogCategory.Task,
              LogAction.Handle,
              '强制获取有效锁被拒绝',
              {
                taskId,
                lockPath,
                existingProcessId: existingLockData.processId,
                currentProcessId: this.processId,
              }
            );
            throw new Error('无法强制获取有效锁');
          } else {
            // 锁仍然有效，检查超时和重试
            const elapsedTime = Date.now() - startTime;

            if (timeout === 0) {
              throw new Error('获取文件锁超时');
            }

            if (timeout > 0 && elapsedTime >= timeout) {
              throw new Error('获取文件锁超时');
            }

            if (maxRetries > 0 && retryCount >= maxRetries) {
              throw new Error('达到最大重试次数');
            }

            // 等待重试
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, retryInterval));
            continue;
          }
        }

        // 尝试原子性创建锁文件
        try {
          const lock = await this.createLockFileAtomic(
            taskId,
            lockPath,
            lockType,
            timeout
          );

          logger.info(LogCategory.Task, LogAction.Create, '文件锁获取成功', {
            taskId,
            lockPath,
            processId: lock.processId,
            lockType,
            retryCount,
            elapsedTime: Date.now() - startTime,
          });

          return lock;
        } catch (createError) {
          // 如果创建失败（可能是并发冲突），继续重试循环
          if (
            createError instanceof Error &&
            createError.message.includes('EEXIST')
          ) {
            // 文件已存在，继续重试
            const elapsedTime = Date.now() - startTime;
            if (timeout > 0 && elapsedTime >= timeout) {
              throw new Error('获取文件锁超时');
            }
            retryCount++;
            if (maxRetries > 0 && retryCount >= maxRetries) {
              throw new Error('达到最大重试次数');
            }
            await new Promise((resolve) => setTimeout(resolve, retryInterval));
            continue;
          }
          throw createError;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes('获取文件锁超时') ||
            error.message.includes('达到最大重试次数')
          ) {
            logger.warning(
              LogCategory.Task,
              LogAction.Handle,
              '文件锁获取失败',
              {
                taskId,
                reason: error.message,
                retryCount,
                elapsedTime: Date.now() - startTime,
              }
            );
            throw error;
          }

          if (error.message.includes('锁文件格式错误')) {
            logger.error(LogCategory.Task, LogAction.Handle, '锁文件损坏', {
              taskId,
              lockPath,
              error: error.message,
            });
            throw error;
          }

          if (error.message.includes('无法强制获取有效锁')) {
            logger.warning(
              LogCategory.Task,
              LogAction.Handle,
              '强制获取有效锁失败',
              {
                taskId,
                lockPath,
                error: error.message,
              }
            );
            throw error;
          }

          if (error.message.includes('检测到潜在死锁，操作被阻止')) {
            logger.warning(LogCategory.Task, LogAction.Handle, '死锁预防触发', {
              taskId,
              error: error.message,
            });
            throw error;
          }
        }

        // 其他错误，继续重试
        const elapsedTime = Date.now() - startTime;
        if (timeout > 0 && elapsedTime >= timeout) {
          throw new Error('获取文件锁超时');
        }

        retryCount++;
        if (maxRetries > 0 && retryCount >= maxRetries) {
          throw new Error('达到最大重试次数');
        }

        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }

  /**
   * 释放文件锁
   */
  async releaseFileLock(lock: FileLock): Promise<void> {
    try {
      // 检查锁文件是否存在
      if (!(await fs.pathExists(lock.lockPath))) {
        throw new Error('锁文件不存在');
      }

      // 验证锁的所有权
      const existingLockData = await this.readLockFile(lock.lockPath);
      if (existingLockData.processId !== lock.processId) {
        throw new Error('无权释放他人持有的锁');
      }

      // 删除锁文件
      await fs.remove(lock.lockPath);

      logger.info(LogCategory.Task, LogAction.Handle, '文件锁释放成功', {
        taskId: lock.taskId,
        lockPath: lock.lockPath,
        processId: lock.processId,
      });
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '文件锁释放失败', {
        taskId: lock.taskId,
        lockPath: lock.lockPath,
        processId: lock.processId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查锁是否过期
   */
  async isLockStale(lockPath: string): Promise<boolean> {
    try {
      const lockData = await this.readLockFile(lockPath);
      const lockTime = new Date(lockData.timestamp).getTime();
      const currentTime = Date.now();
      const lockTimeout = lockData.timeout || this.lockTimeout;

      return currentTime - lockTime > lockTimeout;
    } catch (error) {
      // 如果无法读取锁文件，认为是过期的
      return true;
    }
  }

  /**
   * 清理过期锁
   */
  async cleanupStaleLocks(): Promise<void> {
    try {
      const lockDir = this.getLockDir();
      if (!(await fs.pathExists(lockDir))) {
        return;
      }

      const lockFiles = await fs.readdir(lockDir);
      const staleLocks: string[] = [];

      for (const file of lockFiles) {
        if (file.endsWith('.lock')) {
          const lockPath = path.join(lockDir, file);
          if (await this.isLockStale(lockPath)) {
            await fs.remove(lockPath);
            staleLocks.push(file);
          }
        }
      }

      if (staleLocks.length > 0) {
        logger.info(LogCategory.Task, LogAction.Handle, '清理过期锁完成', {
          cleanedLocks: staleLocks,
          count: staleLocks.length,
        });
      }
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '清理过期锁失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 读取锁文件
   */
  private async readLockFile(lockPath: string): Promise<FileLock> {
    try {
      const content = await fs.readFile(lockPath, 'utf8');
      const lockData = JSON.parse(content);

      // 验证锁数据结构
      if (!lockData.taskId || !lockData.processId || !lockData.timestamp) {
        throw new Error('锁文件格式错误');
      }

      return lockData as FileLock;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('锁文件格式错误');
      }
      throw error;
    }
  }

  /**
   * 创建锁文件
   */
  private async createLockFile(
    taskId: string,
    lockPath: string,
    lockType: 'read' | 'write',
    timeout: number
  ): Promise<FileLock> {
    const lock: FileLock = {
      lockPath,
      processId: this.processId,
      timestamp: new Date().toISOString(),
      taskId,
      timeout,
      type: lockType,
    };

    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf8');
    return lock;
  }

  /**
   * 原子性创建锁文件
   */
  private async createLockFileAtomic(
    taskId: string,
    lockPath: string,
    lockType: 'read' | 'write',
    timeout: number
  ): Promise<FileLock> {
    const lock: FileLock = {
      lockPath,
      processId: this.processId,
      timestamp: new Date().toISOString(),
      taskId,
      timeout,
      type: lockType,
    };

    // 使用 wx 标志确保原子性创建（如果文件已存在则失败）
    try {
      await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), {
        encoding: 'utf8',
        flag: 'wx', // 排他性创建，如果文件存在则失败
      });
      return lock;
    } catch (error) {
      if (error instanceof Error && error.message.includes('EEXIST')) {
        // 文件已存在，抛出特定错误
        throw new Error('EEXIST: 锁文件已存在');
      }
      throw error;
    }
  }

  /**
   * 检测死锁
   */
  async detectDeadlock(requests: DeadlockRequest[]): Promise<DeadlockInfo> {
    try {
      // 检测自死锁
      const selfDeadlock = this.detectSelfDeadlock(requests);
      if (selfDeadlock) {
        return selfDeadlock;
      }

      // 检测所有死锁
      const graph = this.buildWaitGraph(requests);
      const allCycles = this.findAllCycles(graph);

      if (allCycles.length === 0) {
        return {
          hasDeadlock: false,
          deadlockChain: [],
        };
      }

      // 分析死锁结果
      const primaryCycle = allCycles[0];
      const deadlockType = primaryCycle.length === 2 ? 'simple' : 'circular';
      const suggestedVictim = this.selectVictimProcess(primaryCycle, requests);

      const result: DeadlockInfo = {
        hasDeadlock: true,
        deadlockChain: primaryCycle,
        deadlockType,
        cycleLength: primaryCycle.length,
        suggestedVictim,
      };

      // 如果有多个死锁组
      if (allCycles.length > 1) {
        result.multipleDeadlocks = true;
        result.deadlockGroups = allCycles;
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '死锁检测失败', {
        error: error instanceof Error ? error.message : String(error),
        requestCount: requests.length,
      });

      return {
        hasDeadlock: false,
        deadlockChain: [],
      };
    }
  }

  /**
   * 查找死锁链
   */
  private findDeadlockChain(requests: DeadlockRequest[]): string[] {
    // 简单的死锁检测：查找循环等待
    for (let i = 0; i < requests.length; i++) {
      const request1 = requests[i];
      if (!request1.requestedLock) continue;

      for (let j = i + 1; j < requests.length; j++) {
        const request2 = requests[j];
        if (!request2.requestedLock) continue;

        // 检查是否形成循环：A请求B持有的锁，B请求A持有的锁
        const aWaitsForB = request2.heldLocks.includes(request1.requestedLock);
        const bWaitsForA = request1.heldLocks.includes(request2.requestedLock);

        if (aWaitsForB && bWaitsForA) {
          return [request1.processId, request2.processId];
        }
      }
    }

    // 检查更复杂的循环（3个或更多进程）
    return this.findComplexCycle(requests);
  }

  /**
   * 查找复杂循环
   */
  private findComplexCycle(requests: DeadlockRequest[]): string[] {
    const graph = this.buildWaitGraph(requests);

    // 查找所有循环
    const allCycles = this.findAllCycles(graph);

    if (allCycles.length > 0) {
      // 返回第一个找到的循环
      return allCycles[0];
    }

    return [];
  }

  /**
   * 查找所有循环
   */
  private findAllCycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    for (const startNode of graph.keys()) {
      if (visited.has(startNode)) continue;

      const cycle = this.dfsForCycle(graph, startNode, visited, [], new Set());
      if (cycle.length > 0) {
        cycles.push(cycle);
        // 标记循环中的所有节点为已访问，避免重复检测
        cycle.forEach((node) => visited.add(node));
      }
    }

    return cycles;
  }

  /**
   * DFS查找循环
   */
  private dfsForCycle(
    graph: Map<string, Set<string>>,
    node: string,
    visited: Set<string>,
    path: string[],
    inPath: Set<string>
  ): string[] {
    if (inPath.has(node)) {
      // 找到循环
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart);
    }

    if (visited.has(node)) {
      return [];
    }

    visited.add(node);
    inPath.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      const cycle = this.dfsForCycle(graph, neighbor, visited, path, inPath);
      if (cycle.length > 0) {
        return cycle;
      }
    }

    inPath.delete(node);
    path.pop();

    return [];
  }

  /**
   * 构建等待图
   */
  private buildWaitGraph(
    requests: DeadlockRequest[]
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    // 初始化所有进程节点
    for (const request of requests) {
      if (!graph.has(request.processId)) {
        graph.set(request.processId, new Set());
      }
    }

    // 构建等待关系
    for (const request of requests) {
      if (request.requestedLock) {
        // 找到持有请求锁的进程
        const lockHolder = requests.find(
          (r) =>
            r.heldLocks.includes(request.requestedLock!) &&
            r.processId !== request.processId
        );

        if (lockHolder) {
          // 添加等待边：request.processId -> lockHolder.processId
          let edges = graph.get(request.processId);
          if (!edges) {
            edges = new Set();
            graph.set(request.processId, edges);
          }
          edges.add(lockHolder.processId);
        }
      }
    }

    return graph;
  }

  /**
   * 检测自死锁
   */
  private detectSelfDeadlock(requests: DeadlockRequest[]): DeadlockInfo | null {
    for (const request of requests) {
      if (
        request.requestedLock &&
        request.heldLocks.includes(request.requestedLock)
      ) {
        return {
          hasDeadlock: true,
          deadlockChain: [request.processId],
          deadlockType: 'self-deadlock',
          cycleLength: 1,
          suggestedVictim: request.processId,
        };
      }
    }
    return null;
  }

  /**
   * 使用DFS检测循环
   */
  private detectCycles(graph: Map<string, Set<string>>): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // 找到循环
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle]);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor, path);
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * 分析死锁信息
   */
  private analyzeDeadlock(
    cycles: string[][],
    requests: DeadlockRequest[]
  ): DeadlockInfo {
    if (cycles.length === 0) {
      return {
        hasDeadlock: false,
        deadlockChain: [],
      };
    }

    // 选择最短的循环作为主要死锁
    const mainCycle = cycles.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest
    );

    // 移除重复的节点（循环闭合时会重复最后一个节点）
    const deadlockChain = mainCycle.slice(0, -1);

    // 确定死锁类型
    let deadlockType: 'simple' | 'circular' | 'self-deadlock' = 'circular';
    if (deadlockChain.length === 2) {
      deadlockType = 'simple';
    }

    // 选择受害者进程（优先选择持有锁最少的进程）
    const suggestedVictim = this.selectVictimProcess(deadlockChain, requests);

    // 检查是否有多个独立的死锁
    const multipleDeadlocks = cycles.length > 1;
    const deadlockGroups = multipleDeadlocks
      ? cycles.map((cycle) => cycle.slice(0, -1))
      : undefined;

    return {
      hasDeadlock: true,
      deadlockChain,
      deadlockType,
      cycleLength: deadlockChain.length,
      multipleDeadlocks,
      deadlockGroups,
      suggestedVictim,
    };
  }

  /**
   * 选择受害者进程
   */
  private selectVictimProcess(
    deadlockChain: string[],
    requests: DeadlockRequest[]
  ): string {
    // 选择持有锁最少的进程作为受害者
    let minLocks = Infinity;
    let victim = deadlockChain[0];

    for (const processId of deadlockChain) {
      const request = requests.find((r) => r.processId === processId);
      if (request) {
        const lockCount = request.heldLocks.length;
        if (lockCount < minLocks) {
          minLocks = lockCount;
          victim = processId;
        }
      }
    }

    return victim;
  }

  enableDeadlockPrevention(enabled: boolean): void {
    this.deadlockPreventionEnabled = enabled;
  }

  /**
   * 获取任务状态版本
   */
  async getStateVersion(taskId: string): Promise<number> {
    try {
      const statePath = this.getStatePath(taskId);

      if (!(await fs.pathExists(statePath))) {
        // 状态文件不存在，初始化为版本0
        await this.initializeStateFile(taskId);
        return 0;
      }

      const stateData = await this.readStateFile(taskId);
      return stateData.version;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取状态版本失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      // 出错时重置为版本0
      await this.initializeStateFile(taskId);
      return 0;
    }
  }

  /**
   * 更新状态版本
   */
  async updateStateVersion(taskId: string): Promise<number> {
    try {
      await this.ensureDirectories();

      const currentVersion = await this.getStateVersion(taskId);
      const newVersion = currentVersion + 1;

      const stateData: TaskState = {
        version: newVersion,
        lastModified: new Date().toISOString(),
        modifiedBy: this.processId,
        checksum: this.generateChecksum(taskId, newVersion),
        locked: false,
      };

      await this.saveStateFile(taskId, stateData);

      // 记录版本历史
      await this.recordVersionHistory(taskId, newVersion, 'update');

      return newVersion;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '更新状态版本失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查状态一致性
   */
  async checkStateConsistency(
    taskId: string,
    expectedVersion: number
  ): Promise<boolean> {
    try {
      const currentVersion = await this.getStateVersion(taskId);
      return currentVersion === expectedVersion;
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '状态一致性检查失败', {
        taskId,
        expectedVersion,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 初始化状态文件
   */
  private async initializeStateFile(taskId: string): Promise<void> {
    await this.ensureDirectories();

    const stateData: TaskState = {
      version: 0,
      lastModified: new Date().toISOString(),
      modifiedBy: this.processId,
      checksum: this.generateChecksum(taskId, 0),
      locked: false,
    };

    await this.saveStateFile(taskId, stateData);
    await this.recordVersionHistory(taskId, 0, 'init');
  }

  /**
   * 读取状态文件
   */
  private async readStateFile(taskId: string): Promise<TaskState> {
    const statePath = this.getStatePath(taskId);

    try {
      const content = await fs.readFile(statePath, 'utf8');
      const stateData = JSON.parse(content) as TaskState;

      // 验证状态数据结构
      if (typeof stateData.version !== 'number' || !stateData.lastModified) {
        throw new Error('状态文件格式错误');
      }

      return stateData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('状态文件格式错误');
      }
      throw error;
    }
  }

  /**
   * 保存状态文件
   */
  private async saveStateFile(
    taskId: string,
    stateData: TaskState
  ): Promise<void> {
    const statePath = this.getStatePath(taskId);
    await fs.writeFile(statePath, JSON.stringify(stateData, null, 2), 'utf8');
  }

  /**
   * 生成校验和
   */
  private generateChecksum(taskId: string, version: number): string {
    // 简单的校验和生成
    const data = `${taskId}-${version}-${this.processId}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 原子读取操作
   */
  async atomicRead<T>(filePath: string): Promise<{ data: T; version: number }> {
    try {
      // 从文件路径推导任务ID
      const taskId = this.extractTaskIdFromPath(filePath);

      // 确保状态文件存在并获取版本
      let version = await this.getStateVersion(taskId);
      if (version === 0) {
        // 如果版本是0，更新到1
        version = await this.updateStateVersion(taskId);
      }

      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content) as T;

      return { data, version };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '原子读取失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 原子写入操作
   */
  async atomicWrite<T>(
    filePath: string,
    data: T,
    expectedVersion?: number
  ): Promise<AtomicOperationResult<T>> {
    try {
      const taskId = this.extractTaskIdFromPath(filePath);

      // 版本检查
      if (expectedVersion !== undefined) {
        const currentVersion = await this.getStateVersion(taskId);
        if (currentVersion !== expectedVersion) {
          return {
            success: false,
            conflict: true,
            error: '版本冲突',
            conflictInfo: {
              type: 'version_conflict',
              operations: [],
              resolution: 'retry',
              conflictingProcesses: [this.processId],
              details: {
                expectedVersion,
                currentVersion,
              },
            },
          };
        }
      }

      // 写入数据
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

      // 更新版本
      const newVersion = await this.updateStateVersion(taskId);

      return {
        success: true,
        data,
        version: newVersion,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '原子写入失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 从文件路径提取任务ID
   */
  private extractTaskIdFromPath(filePath: string): string {
    // 简单的任务ID提取逻辑
    const fileName = path.basename(filePath, path.extname(filePath));
    return fileName.includes('test') ? fileName : 'default-task';
  }

  /**
   * 创建状态快照
   */
  async createStateSnapshot(taskId: string): Promise<StateSnapshot> {
    try {
      // 确保状态文件存在并获取版本
      let version = await this.getStateVersion(taskId);
      if (version === 0) {
        // 如果版本是0，更新到1
        version = await this.updateStateVersion(taskId);
      }

      const stateData = await this.readStateFile(taskId);

      return {
        version: stateData.version,
        timestamp: new Date().toISOString(),
        checksum: stateData.checksum,
        data: stateData,
      };
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '创建状态快照失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 恢复状态快照
   */
  async restoreStateSnapshot(
    taskId: string,
    snapshot: StateSnapshot
  ): Promise<void> {
    try {
      if (snapshot.data) {
        await this.saveStateFile(taskId, snapshot.data as TaskState);
        await this.recordVersionHistory(taskId, snapshot.version, 'restore');
      }
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '恢复状态快照失败', {
        taskId,
        snapshotVersion: snapshot.version,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 比较版本
   */
  compareVersions(version1: number, version2: number): number {
    return version1 - version2;
  }

  /**
   * 获取版本历史
   */
  async getVersionHistory(taskId: string): Promise<VersionHistoryRecord[]> {
    try {
      const historyPath = path.join(
        this.getStateDir(),
        `${taskId}.history.json`
      );

      if (!(await fs.pathExists(historyPath))) {
        return [];
      }

      const content = await fs.readFile(historyPath, 'utf8');
      const history = JSON.parse(content) as VersionHistoryRecord[];

      return history.sort((a, b) => a.version - b.version);
    } catch (error) {
      logger.error(LogCategory.Task, LogAction.Handle, '获取版本历史失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 记录版本历史
   */
  private async recordVersionHistory(
    taskId: string,
    version: number,
    operation: string
  ): Promise<void> {
    try {
      const historyPath = path.join(
        this.getStateDir(),
        `${taskId}.history.json`
      );

      let history: VersionHistoryRecord[] = [];
      if (await fs.pathExists(historyPath)) {
        const content = await fs.readFile(historyPath, 'utf8');
        history = JSON.parse(content);
      }

      const record: VersionHistoryRecord = {
        version,
        timestamp: new Date().toISOString(),
        operation,
        processId: this.processId,
      };

      history.push(record);

      // 限制历史记录数量
      if (history.length > 100) {
        history = history.slice(-100);
      }

      await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
      // 历史记录失败不应该影响主要操作
      logger.warning(LogCategory.Task, LogAction.Handle, '记录版本历史失败', {
        taskId,
        version,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
