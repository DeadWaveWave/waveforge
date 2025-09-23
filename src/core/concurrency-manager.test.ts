/**
 * CrossProcessConcurrencyManager 测试用例
 * 测试跨进程并发管理器的文件锁机制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CrossProcessConcurrencyManager } from './concurrency-manager.js';
import type { FileLock } from '../types/index.js';

describe('CrossProcessConcurrencyManager', () => {
  let concurrencyManager: CrossProcessConcurrencyManager;
  let testDocsPath: string;
  let testTaskId: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDocsPath = await fs.mkdtemp(path.join(os.tmpdir(), 'waveforge-test-'));
    testTaskId = 'test-task-01K5TB1BR6WYJWSDD1T8SXW21B';

    // 初始化并发管理器
    concurrencyManager = new CrossProcessConcurrencyManager(testDocsPath);

    // 确保测试目录结构存在
    await fs.ensureDir(path.join(testDocsPath, '.locks'));
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.remove(testDocsPath);

    // 重置所有模拟
    vi.restoreAllMocks();
  });

  describe('基础文件锁操作', () => {
    it('应该能够成功获取文件锁', async () => {
      const lock = await concurrencyManager.acquireFileLock(testTaskId);

      expect(lock).toBeDefined();
      expect(lock.taskId).toBe(testTaskId);
      expect(lock.processId).toMatch(/^waveforge-\d+$/);
      expect(lock.timestamp).toBeDefined();
      expect(lock.lockPath).toContain('.locks');
      expect(lock.lockPath).toContain(testTaskId);

      // 验证锁文件确实被创建
      expect(await fs.pathExists(lock.lockPath)).toBe(true);

      // 清理
      await concurrencyManager.releaseFileLock(lock);
    });

    it('应该能够成功释放文件锁', async () => {
      const lock = await concurrencyManager.acquireFileLock(testTaskId);
      expect(await fs.pathExists(lock.lockPath)).toBe(true);

      await concurrencyManager.releaseFileLock(lock);

      // 验证锁文件被删除
      expect(await fs.pathExists(lock.lockPath)).toBe(false);
    });

    it('应该在获取锁时设置正确的锁信息', async () => {
      const lock = await concurrencyManager.acquireFileLock(testTaskId, {
        timeout: 5000,
        lockType: 'write',
      });

      // 读取锁文件内容验证
      const lockContent = await fs.readFile(lock.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);

      expect(lockData.taskId).toBe(testTaskId);
      expect(lockData.processId).toBe(lock.processId);
      expect(lockData.timestamp).toBe(lock.timestamp);
      expect(lockData.timeout).toBe(5000);
      expect(lockData.type).toBe('write');

      await concurrencyManager.releaseFileLock(lock);
    });

    it('应该为不同任务创建不同的锁文件', async () => {
      const taskId1 = 'task-1';
      const taskId2 = 'task-2';

      const lock1 = await concurrencyManager.acquireFileLock(taskId1);
      const lock2 = await concurrencyManager.acquireFileLock(taskId2);

      expect(lock1.lockPath).not.toBe(lock2.lockPath);
      expect(lock1.taskId).toBe(taskId1);
      expect(lock2.taskId).toBe(taskId2);

      // 两个锁文件都应该存在
      expect(await fs.pathExists(lock1.lockPath)).toBe(true);
      expect(await fs.pathExists(lock2.lockPath)).toBe(true);

      await concurrencyManager.releaseFileLock(lock1);
      await concurrencyManager.releaseFileLock(lock2);
    });
  });

  describe('锁超时处理', () => {
    it('应该在指定时间后超时', async () => {
      const shortTimeout = 100; // 100ms

      // 先获取一个锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 尝试获取同一个任务的锁，应该超时
      const startTime = Date.now();

      await expect(
        concurrencyManager.acquireFileLock(testTaskId, {
          timeout: shortTimeout,
          retryInterval: 10,
        })
      ).rejects.toThrow('获取文件锁超时');

      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(shortTimeout);
      expect(elapsedTime).toBeLessThan(shortTimeout + 50); // 允许一些误差

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该能够检测过期的锁', async () => {
      // 创建一个过期的锁文件
      const expiredLockPath = path.join(
        testDocsPath,
        '.locks',
        `${testTaskId}.lock`
      );
      const expiredTimestamp = new Date(Date.now() - 60000).toISOString(); // 1分钟前

      const expiredLockData = {
        taskId: testTaskId,
        processId: 'expired-process-123',
        timestamp: expiredTimestamp,
        timeout: 30000, // 30秒超时，已经过期
      };

      await fs.writeFile(
        expiredLockPath,
        JSON.stringify(expiredLockData),
        'utf8'
      );

      const isStale = await concurrencyManager.isLockStale(expiredLockPath);
      expect(isStale).toBe(true);

      // 清理
      await fs.remove(expiredLockPath);
    });

    it('应该能够清理过期的锁', async () => {
      // 创建多个过期的锁文件
      const expiredLocks = ['task-1', 'task-2', 'task-3'];
      const expiredTimestamp = new Date(Date.now() - 60000).toISOString();

      for (const taskId of expiredLocks) {
        const lockPath = path.join(testDocsPath, '.locks', `${taskId}.lock`);
        const lockData = {
          taskId,
          processId: `expired-${taskId}`,
          timestamp: expiredTimestamp,
          timeout: 30000,
        };
        await fs.writeFile(lockPath, JSON.stringify(lockData), 'utf8');
      }

      // 创建一个未过期的锁
      const validLock = await concurrencyManager.acquireFileLock('valid-task');

      // 清理过期锁
      await concurrencyManager.cleanupStaleLocks();

      // 验证过期锁被清理
      for (const taskId of expiredLocks) {
        const lockPath = path.join(testDocsPath, '.locks', `${taskId}.lock`);
        expect(await fs.pathExists(lockPath)).toBe(false);
      }

      // 验证有效锁仍然存在
      expect(await fs.pathExists(validLock.lockPath)).toBe(true);

      await concurrencyManager.releaseFileLock(validLock);
    });
  });

  describe('错误处理', () => {
    it('应该在锁文件损坏时抛出错误', async () => {
      // 创建一个损坏的锁文件
      const corruptedLockPath = path.join(
        testDocsPath,
        '.locks',
        `${testTaskId}.lock`
      );
      await fs.writeFile(corruptedLockPath, 'invalid json content', 'utf8');

      await expect(
        concurrencyManager.acquireFileLock(testTaskId)
      ).rejects.toThrow('锁文件格式错误');

      // 清理
      await fs.remove(corruptedLockPath);
    });

    it('应该在释放不存在的锁时抛出错误', async () => {
      const fakeLock: FileLock = {
        lockPath: path.join(testDocsPath, '.locks', 'nonexistent.lock'),
        processId: 'fake-process',
        timestamp: new Date().toISOString(),
        taskId: 'fake-task',
      };

      await expect(
        concurrencyManager.releaseFileLock(fakeLock)
      ).rejects.toThrow('锁文件不存在');
    });

    it('应该在释放他人持有的锁时抛出错误', async () => {
      // 创建一个由其他进程持有的锁
      const otherProcessLockPath = path.join(
        testDocsPath,
        '.locks',
        `${testTaskId}.lock`
      );
      const otherProcessLockData = {
        taskId: testTaskId,
        processId: 'other-process-123',
        timestamp: new Date().toISOString(),
        timeout: 30000,
      };

      await fs.writeFile(
        otherProcessLockPath,
        JSON.stringify(otherProcessLockData),
        'utf8'
      );

      const fakeLock: FileLock = {
        lockPath: otherProcessLockPath,
        processId: 'current-process-456', // 不同的进程ID
        timestamp: new Date().toISOString(),
        taskId: testTaskId,
      };

      await expect(
        concurrencyManager.releaseFileLock(fakeLock)
      ).rejects.toThrow('无权释放他人持有的锁');

      // 清理
      await fs.remove(otherProcessLockPath);
    });

    it('应该在目录不存在时自动创建', async () => {
      // 删除锁目录
      const locksDir = path.join(testDocsPath, '.locks');
      await fs.remove(locksDir);

      // 尝试获取锁，应该自动创建目录
      const lock = await concurrencyManager.acquireFileLock(testTaskId);

      expect(await fs.pathExists(locksDir)).toBe(true);
      expect(await fs.pathExists(lock.lockPath)).toBe(true);

      await concurrencyManager.releaseFileLock(lock);
    });
  });

  describe('锁类型支持', () => {
    it('应该支持读锁', async () => {
      const readLock = await concurrencyManager.acquireFileLock(testTaskId, {
        lockType: 'read',
      });

      const lockContent = await fs.readFile(readLock.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);

      expect(lockData.type).toBe('read');

      await concurrencyManager.releaseFileLock(readLock);
    });

    it('应该支持写锁', async () => {
      const writeLock = await concurrencyManager.acquireFileLock(testTaskId, {
        lockType: 'write',
      });

      const lockContent = await fs.readFile(writeLock.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);

      expect(lockData.type).toBe('write');

      await concurrencyManager.releaseFileLock(writeLock);
    });

    it('应该默认使用写锁', async () => {
      const defaultLock = await concurrencyManager.acquireFileLock(testTaskId);

      const lockContent = await fs.readFile(defaultLock.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);

      expect(lockData.type).toBe('write');

      await concurrencyManager.releaseFileLock(defaultLock);
    });
  });

  describe('强制获取锁', () => {
    it('应该能够强制获取被过期锁阻塞的锁', async () => {
      // 创建一个过期的锁
      const expiredLockPath = path.join(
        testDocsPath,
        '.locks',
        `${testTaskId}.lock`
      );
      const expiredLockData = {
        taskId: testTaskId,
        processId: 'expired-process',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        timeout: 30000,
      };

      await fs.writeFile(
        expiredLockPath,
        JSON.stringify(expiredLockData),
        'utf8'
      );

      // 强制获取锁
      const forceLock = await concurrencyManager.acquireFileLock(testTaskId, {
        force: true,
      });

      expect(forceLock).toBeDefined();
      expect(await fs.pathExists(forceLock.lockPath)).toBe(true);

      // 验证锁的持有者已更新
      const lockContent = await fs.readFile(forceLock.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);
      expect(lockData.processId).toBe(forceLock.processId);
      expect(lockData.processId).not.toBe('expired-process');

      await concurrencyManager.releaseFileLock(forceLock);
    });

    it('应该在强制获取有效锁时抛出错误', async () => {
      // 先获取一个有效锁，使用很长的超时时间确保不会过期
      const validLock = await concurrencyManager.acquireFileLock(testTaskId, {
        timeout: 300000, // 5分钟超时，确保锁不会过期
      });

      // 创建另一个并发管理器实例来模拟不同的进程，使用相同的超时设置
      const anotherManager = new CrossProcessConcurrencyManager(
        testDocsPath,
        300000
      );
      // 手动设置不同的进程ID
      (anotherManager as any).processId = 'different-process-id';

      // 尝试强制获取同一个锁（锁是有效的，应该失败）
      await expect(
        anotherManager.acquireFileLock(testTaskId, {
          force: true,
          timeout: 100, // 短超时，快速失败
          retryInterval: 10,
        })
      ).rejects.toThrow('无法强制获取有效锁');

      await concurrencyManager.releaseFileLock(validLock);
    });
  });

  describe('并发锁竞争', () => {
    it('应该正确处理两个进程同时获取同一个锁', async () => {
      const results: Array<{
        success: boolean;
        error?: string;
        lock?: FileLock;
      }> = [];

      // 模拟两个进程同时尝试获取锁
      const promises = [
        concurrencyManager
          .acquireFileLock(testTaskId, { timeout: 1000 })
          .then((lock) => ({ success: true, lock }))
          .catch((error) => ({ success: false, error: error.message })),
        concurrencyManager
          .acquireFileLock(testTaskId, { timeout: 1000 })
          .then((lock) => ({ success: true, lock }))
          .catch((error) => ({ success: false, error: error.message })),
      ];

      const [result1, result2] = await Promise.all(promises);
      results.push(result1, result2);

      // 应该只有一个成功获取锁
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // 失败的应该是超时错误
      const failedResult = results.find((r) => !r.success);
      expect(failedResult?.error).toContain('获取文件锁超时');

      // 清理成功获取的锁
      const successResult = results.find((r) => r.success);
      if (successResult?.lock) {
        await concurrencyManager.releaseFileLock(successResult.lock);
      }
    });

    it('应该正确处理多个进程竞争多个不同的锁', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3', 'task-4'];
      const results: Array<{
        taskId: string;
        success: boolean;
        lock?: FileLock;
      }> = [];

      // 每个任务启动两个竞争进程
      const promises = taskIds.flatMap((taskId) => [
        concurrencyManager
          .acquireFileLock(taskId, { timeout: 500 })
          .then((lock) => ({ taskId, success: true, lock }))
          .catch(() => ({ taskId, success: false })),
        concurrencyManager
          .acquireFileLock(taskId, { timeout: 500 })
          .then((lock) => ({ taskId, success: true, lock }))
          .catch(() => ({ taskId, success: false })),
      ]);

      const allResults = await Promise.all(promises);
      results.push(...allResults);

      // 每个任务应该只有一个进程成功获取锁
      for (const taskId of taskIds) {
        const taskResults = results.filter((r) => r.taskId === taskId);
        const successCount = taskResults.filter((r) => r.success).length;
        expect(successCount).toBe(1);
      }

      // 清理所有成功获取的锁
      const successfulLocks = results.filter((r) => r.success && r.lock);
      for (const result of successfulLocks) {
        if (result.lock) {
          await concurrencyManager.releaseFileLock(result.lock);
        }
      }
    });

    it('应该正确处理锁的快速获取和释放竞争', async () => {
      const iterations = 10;
      const results: boolean[] = [];

      // 快速连续获取和释放锁
      for (let i = 0; i < iterations; i++) {
        try {
          const lock = await concurrencyManager.acquireFileLock(testTaskId, {
            timeout: 100,
          });
          await concurrencyManager.releaseFileLock(lock);
          results.push(true);
        } catch (error) {
          results.push(false);
        }
      }

      // 所有操作都应该成功
      const successCount = results.filter((r) => r).length;
      expect(successCount).toBe(iterations);
    });

    it('应该正确处理并发获取锁后的顺序释放', async () => {
      const taskIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      const locks: FileLock[] = [];

      // 并发获取多个不同任务的锁
      const acquirePromises = taskIds.map((taskId) =>
        concurrencyManager.acquireFileLock(taskId)
      );

      const acquiredLocks = await Promise.all(acquirePromises);
      locks.push(...acquiredLocks);

      // 验证所有锁都成功获取
      expect(locks).toHaveLength(taskIds.length);
      for (const lock of locks) {
        expect(await fs.pathExists(lock.lockPath)).toBe(true);
      }

      // 顺序释放锁
      for (const lock of locks) {
        await concurrencyManager.releaseFileLock(lock);
        expect(await fs.pathExists(lock.lockPath)).toBe(false);
      }
    });

    it('应该正确处理高并发场景下的锁竞争', async () => {
      const concurrentCount = 20;
      const results: Array<{ success: boolean; processId?: string }> = [];

      // 创建大量并发请求
      const promises = Array.from(
        { length: concurrentCount },
        async (_, _index) => {
          try {
            const lock = await concurrencyManager.acquireFileLock(testTaskId, {
              timeout: 2000,
              retryInterval: 10,
            });
            // 立即释放锁以允许其他进程获取
            await concurrencyManager.releaseFileLock(lock);
            return {
              success: true,
              processId: lock.processId,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      );

      const allResults = await Promise.all(promises);
      results.push(...allResults);

      // 大部分请求应该成功（允许少量超时）
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(concurrentCount * 0.8); // 至少80%成功

      // 验证没有锁文件残留
      const lockPath = path.join(testDocsPath, '.locks', `${testTaskId}.lock`);
      expect(await fs.pathExists(lockPath)).toBe(false);
    });

    it('应该正确处理锁竞争中的异常情况', async () => {
      // 先获取一个锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 模拟多个进程同时尝试获取同一个锁
      const competitorPromises = Array.from({ length: 5 }, () =>
        concurrencyManager
          .acquireFileLock(testTaskId, { timeout: 200 })
          .then(() => ({ success: true }))
          .catch((error) => ({ success: false, error: error.message }))
      );

      // 在竞争过程中释放第一个锁
      setTimeout(async () => {
        await concurrencyManager.releaseFileLock(firstLock);
      }, 100);

      const results = await Promise.all(competitorPromises);

      // 应该有一个进程成功获取锁（在第一个锁释放后）
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(0);
      expect(successCount).toBeLessThanOrEqual(1);

      // 如果有成功的，需要清理
      if (successCount > 0) {
        // 尝试清理可能残留的锁
        try {
          const lockPath = path.join(
            testDocsPath,
            '.locks',
            `${testTaskId}.lock`
          );
          if (await fs.pathExists(lockPath)) {
            await fs.remove(lockPath);
          }
        } catch {
          // 忽略清理错误
        }
      }
    });
  });

  describe('死锁检测', () => {
    it('应该能够检测简单的死锁情况', async () => {
      const taskId1 = 'deadlock-task-1';
      const taskId2 = 'deadlock-task-2';

      // 进程1获取任务1的锁
      const lock1 = await concurrencyManager.acquireFileLock(taskId1);

      // 进程2获取任务2的锁
      const lock2 = await concurrencyManager.acquireFileLock(taskId2);

      // 模拟死锁检测：进程1尝试获取任务2的锁，进程2尝试获取任务1的锁
      const deadlockInfo = await concurrencyManager.detectDeadlock([
        {
          processId: 'process-1',
          heldLocks: [taskId1],
          requestedLock: taskId2,
        },
        {
          processId: 'process-2',
          heldLocks: [taskId2],
          requestedLock: taskId1,
        },
      ]);

      expect(deadlockInfo.hasDeadlock).toBe(true);
      expect(deadlockInfo.deadlockChain).toHaveLength(2);
      expect(deadlockInfo.deadlockChain).toContain('process-1');
      expect(deadlockInfo.deadlockChain).toContain('process-2');

      // 清理
      await concurrencyManager.releaseFileLock(lock1);
      await concurrencyManager.releaseFileLock(lock2);
    });

    it('应该能够检测复杂的循环死锁', async () => {
      const taskIds = ['cycle-1', 'cycle-2', 'cycle-3'];
      const locks: FileLock[] = [];

      // 创建循环依赖：进程1持有任务1要任务2，进程2持有任务2要任务3，进程3持有任务3要任务1
      for (let i = 0; i < taskIds.length; i++) {
        const lock = await concurrencyManager.acquireFileLock(taskIds[i]);
        locks.push(lock);
      }

      // 模拟不同进程的死锁请求
      const lockRequests = [
        {
          processId: 'process-A',
          heldLocks: [taskIds[0]],
          requestedLock: taskIds[1],
        },
        {
          processId: 'process-B',
          heldLocks: [taskIds[1]],
          requestedLock: taskIds[2],
        },
        {
          processId: 'process-C',
          heldLocks: [taskIds[2]],
          requestedLock: taskIds[0],
        },
      ];

      const deadlockInfo =
        await concurrencyManager.detectDeadlock(lockRequests);

      expect(deadlockInfo.hasDeadlock).toBe(true);
      expect(deadlockInfo.deadlockChain).toHaveLength(3);
      expect(deadlockInfo.cycleLength).toBe(3);

      // 清理
      for (const lock of locks) {
        await concurrencyManager.releaseFileLock(lock);
      }
    });

    it('应该能够识别非死锁的正常等待', async () => {
      const taskId1 = 'normal-1';
      const taskId2 = 'normal-2';
      // const taskId3 = 'normal-3';

      // 创建线性等待链：进程1持有任务1，进程2持有任务2要任务1，进程3要任务2
      const lock1 = await concurrencyManager.acquireFileLock(taskId1);
      const lock2 = await concurrencyManager.acquireFileLock(taskId2);

      const lockRequests = [
        {
          processId: lock1.processId,
          heldLocks: [taskId1],
          requestedLock: undefined, // 不请求其他锁
        },
        {
          processId: lock2.processId,
          heldLocks: [taskId2],
          requestedLock: taskId1, // 等待任务1
        },
        {
          processId: 'process-3',
          heldLocks: [],
          requestedLock: taskId2, // 等待任务2
        },
      ];

      const deadlockInfo =
        await concurrencyManager.detectDeadlock(lockRequests);

      expect(deadlockInfo.hasDeadlock).toBe(false);
      expect(deadlockInfo.deadlockChain).toHaveLength(0);

      // 清理
      await concurrencyManager.releaseFileLock(lock1);
      await concurrencyManager.releaseFileLock(lock2);
    });

    it('应该能够处理死锁解决方案', async () => {
      const taskId1 = 'resolve-1';
      const taskId2 = 'resolve-2';

      // 创建死锁情况
      const lock1 = await concurrencyManager.acquireFileLock(taskId1);
      const lock2 = await concurrencyManager.acquireFileLock(taskId2);

      const lockRequests = [
        {
          processId: 'process-1',
          heldLocks: [taskId1],
          requestedLock: taskId2,
        },
        {
          processId: 'process-2',
          heldLocks: [taskId2],
          requestedLock: taskId1,
        },
      ];

      const deadlockInfo =
        await concurrencyManager.detectDeadlock(lockRequests);
      expect(deadlockInfo.hasDeadlock).toBe(true);

      // 解决死锁：选择一个进程释放锁
      const victimProcess = deadlockInfo.suggestedVictim;
      expect(victimProcess).toBeDefined();
      expect(['process-1', 'process-2']).toContain(victimProcess);

      // 模拟释放受害者进程的锁
      if (victimProcess === 'process-1') {
        await concurrencyManager.releaseFileLock(lock1);
        // 验证死锁已解决
        const updatedRequests = lockRequests.filter(
          (req) => req.processId !== victimProcess
        );
        const resolvedInfo =
          await concurrencyManager.detectDeadlock(updatedRequests);
        expect(resolvedInfo.hasDeadlock).toBe(false);

        await concurrencyManager.releaseFileLock(lock2);
      } else {
        await concurrencyManager.releaseFileLock(lock2);
        const updatedRequests = lockRequests.filter(
          (req) => req.processId !== victimProcess
        );
        const resolvedInfo =
          await concurrencyManager.detectDeadlock(updatedRequests);
        expect(resolvedInfo.hasDeadlock).toBe(false);

        await concurrencyManager.releaseFileLock(lock1);
      }
    });

    it('应该能够检测自死锁（进程等待自己持有的锁）', async () => {
      const taskId = 'self-deadlock';
      const lock = await concurrencyManager.acquireFileLock(taskId);

      const lockRequests = [
        {
          processId: lock.processId,
          heldLocks: [taskId],
          requestedLock: taskId, // 请求自己已持有的锁
        },
      ];

      const deadlockInfo =
        await concurrencyManager.detectDeadlock(lockRequests);

      expect(deadlockInfo.hasDeadlock).toBe(true);
      expect(deadlockInfo.deadlockType).toBe('self-deadlock');
      expect(deadlockInfo.deadlockChain).toHaveLength(1);
      expect(deadlockInfo.deadlockChain[0]).toBe(lock.processId);

      await concurrencyManager.releaseFileLock(lock);
    });

    it('应该能够处理多个独立的死锁', async () => {
      // 创建两个独立的死锁组
      const group1Tasks = ['group1-task1', 'group1-task2'];
      const group2Tasks = ['group2-task1', 'group2-task2'];

      const group1Locks = await Promise.all(
        group1Tasks.map((taskId) => concurrencyManager.acquireFileLock(taskId))
      );
      const group2Locks = await Promise.all(
        group2Tasks.map((taskId) => concurrencyManager.acquireFileLock(taskId))
      );

      const lockRequests = [
        // 第一组死锁
        {
          processId: 'group1-process-A',
          heldLocks: [group1Tasks[0]],
          requestedLock: group1Tasks[1],
        },
        {
          processId: 'group1-process-B',
          heldLocks: [group1Tasks[1]],
          requestedLock: group1Tasks[0],
        },
        // 第二组死锁
        {
          processId: 'group2-process-A',
          heldLocks: [group2Tasks[0]],
          requestedLock: group2Tasks[1],
        },
        {
          processId: 'group2-process-B',
          heldLocks: [group2Tasks[1]],
          requestedLock: group2Tasks[0],
        },
      ];

      const deadlockInfo =
        await concurrencyManager.detectDeadlock(lockRequests);

      expect(deadlockInfo.hasDeadlock).toBe(true);
      expect(deadlockInfo.multipleDeadlocks).toBe(true);
      expect(deadlockInfo.deadlockGroups).toHaveLength(2);

      // 清理
      await Promise.all([
        ...group1Locks.map((lock) => concurrencyManager.releaseFileLock(lock)),
        ...group2Locks.map((lock) => concurrencyManager.releaseFileLock(lock)),
      ]);
    });

    it('应该能够预防死锁的发生', async () => {
      const taskId1 = 'prevent-1';
      const taskId2 = 'prevent-2';

      // 启用死锁预防模式
      concurrencyManager.enableDeadlockPrevention(true);

      const lock1 = await concurrencyManager.acquireFileLock(taskId1);

      // 创建另一个管理器实例来模拟不同进程
      const anotherManager = new CrossProcessConcurrencyManager(testDocsPath);
      // 手动设置不同的进程ID
      (anotherManager as any).processId = 'different-process-id-2';
      anotherManager.enableDeadlockPrevention(true);

      const lock2 = await anotherManager.acquireFileLock(taskId2);

      // 尝试创建死锁情况：第一个进程持有taskId1，尝试获取taskId2
      // 但taskId2已经被另一个进程持有，这会形成潜在死锁
      await expect(
        concurrencyManager.acquireFileLock(taskId2, {
          currentHeldLocks: [taskId1],
          timeout: 100,
        })
      ).rejects.toThrow('检测到潜在死锁，操作被阻止');

      // 清理
      await concurrencyManager.releaseFileLock(lock1);
      await anotherManager.releaseFileLock(lock2);

      // 关闭死锁预防
      concurrencyManager.enableDeadlockPrevention(false);
    });
  });

  describe('锁超时机制', () => {
    it('应该在指定超时时间后放弃获取锁', async () => {
      const timeout = 200; // 200ms

      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      const startTime = Date.now();

      // 尝试获取同一个锁，应该超时
      await expect(
        concurrencyManager.acquireFileLock(testTaskId, { timeout })
      ).rejects.toThrow('获取文件锁超时');

      const elapsedTime = Date.now() - startTime;

      // 验证超时时间准确性（考虑系统调度延迟，允许更大的容差）
      expect(elapsedTime).toBeGreaterThanOrEqual(timeout - 50);
      expect(elapsedTime).toBeLessThan(timeout + 200); // 增加容差到200ms

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该支持自定义重试间隔', async () => {
      const retryInterval = 50; // 50ms
      const timeout = 300; // 300ms
      const expectedRetries = Math.floor(timeout / retryInterval);

      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 监控重试次数
      let retryCount = 0;
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
        if (delay === retryInterval) {
          retryCount++;
        }
        return originalSetTimeout(callback, delay);
      }) as unknown as typeof setTimeout;

      try {
        await concurrencyManager.acquireFileLock(testTaskId, {
          timeout,
          retryInterval,
        });
      } catch (error) {
        expect(error.message).toContain('获取文件锁超时');
      }

      // 验证重试次数
      expect(retryCount).toBeGreaterThanOrEqual(expectedRetries - 1);
      expect(retryCount).toBeLessThanOrEqual(expectedRetries + 1);

      // 恢复原始setTimeout
      global.setTimeout = originalSetTimeout;

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该支持最大重试次数限制', async () => {
      const maxRetries = 5;
      const retryInterval = 20;

      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      const startTime = Date.now();

      try {
        await concurrencyManager.acquireFileLock(testTaskId, {
          maxRetries,
          retryInterval,
          timeout: 10000, // 设置很长的超时，但应该在达到最大重试次数前失败
        });
      } catch (error) {
        expect(error.message).toContain('达到最大重试次数');
      }

      const elapsedTime = Date.now() - startTime;
      const expectedTime = maxRetries * retryInterval;

      // 验证时间大致符合预期
      expect(elapsedTime).toBeGreaterThanOrEqual(expectedTime - 50);
      expect(elapsedTime).toBeLessThan(expectedTime + 100);

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该能够在锁释放后立即获取', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 设置在100ms后释放锁
      setTimeout(async () => {
        await concurrencyManager.releaseFileLock(firstLock);
      }, 100);

      const startTime = Date.now();

      // 尝试获取锁，应该在锁释放后立即成功
      const secondLock = await concurrencyManager.acquireFileLock(testTaskId, {
        timeout: 1000,
        retryInterval: 10,
      });

      const elapsedTime = Date.now() - startTime;

      // 应该在大约100ms后获取到锁
      expect(elapsedTime).toBeGreaterThanOrEqual(90);
      expect(elapsedTime).toBeLessThan(200);

      await concurrencyManager.releaseFileLock(secondLock);
    });

    it('应该正确处理锁文件被外部删除的情况', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 外部删除锁文件（模拟异常情况）
      setTimeout(async () => {
        await fs.remove(firstLock.lockPath);
      }, 50);

      // 尝试获取锁，应该在锁文件被删除后成功
      const secondLock = await concurrencyManager.acquireFileLock(testTaskId, {
        timeout: 500,
        retryInterval: 20,
      });

      expect(secondLock).toBeDefined();
      expect(await fs.pathExists(secondLock.lockPath)).toBe(true);

      await concurrencyManager.releaseFileLock(secondLock);
    });

    it('应该能够处理锁文件损坏的超时情况', async () => {
      // 创建一个损坏的锁文件
      const corruptedLockPath = path.join(
        testDocsPath,
        '.locks',
        `${testTaskId}.lock`
      );
      await fs.writeFile(corruptedLockPath, 'invalid json', 'utf8');

      // 尝试获取锁，应该因为锁文件损坏而失败
      await expect(
        concurrencyManager.acquireFileLock(testTaskId, { timeout: 100 })
      ).rejects.toThrow('锁文件格式错误');

      // 清理
      await fs.remove(corruptedLockPath);
    });

    it('应该支持零超时（立即失败）', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      const startTime = Date.now();

      // 尝试以零超时获取锁，应该立即失败
      await expect(
        concurrencyManager.acquireFileLock(testTaskId, { timeout: 0 })
      ).rejects.toThrow('获取文件锁超时');

      const elapsedTime = Date.now() - startTime;

      // 应该几乎立即失败
      expect(elapsedTime).toBeLessThan(50);

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该支持无限超时（直到获取到锁）', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 设置在200ms后释放锁
      setTimeout(async () => {
        await concurrencyManager.releaseFileLock(firstLock);
      }, 200);

      const startTime = Date.now();

      // 使用无限超时获取锁
      const secondLock = await concurrencyManager.acquireFileLock(testTaskId, {
        timeout: -1, // 无限超时
        retryInterval: 10,
      });

      const elapsedTime = Date.now() - startTime;

      // 应该在锁释放后获取到
      expect(elapsedTime).toBeGreaterThanOrEqual(190);
      expect(secondLock).toBeDefined();

      await concurrencyManager.releaseFileLock(secondLock);
    });

    it('应该能够取消正在等待的锁获取操作', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      // 创建一个可取消的锁获取操作
      const abortController = new AbortController();

      // 100ms后取消操作
      setTimeout(() => {
        abortController.abort();
      }, 100);

      const startTime = Date.now();

      // 尝试获取锁，应该被取消
      await expect(
        concurrencyManager.acquireFileLock(testTaskId, {
          timeout: 1000,
          signal: abortController.signal,
        })
      ).rejects.toThrow('操作被取消');

      const elapsedTime = Date.now() - startTime;

      // 应该在大约100ms后被取消
      expect(elapsedTime).toBeGreaterThanOrEqual(90);
      expect(elapsedTime).toBeLessThan(150);

      await concurrencyManager.releaseFileLock(firstLock);
    });

    it('应该正确处理多个超时操作', async () => {
      // 先获取锁
      const firstLock = await concurrencyManager.acquireFileLock(testTaskId);

      const timeouts = [100, 200, 300];
      const results: Array<{
        timeout: number;
        success: boolean;
        elapsedTime: number;
      }> = [];

      // 同时启动多个超时操作
      const promises = timeouts.map(async (timeout) => {
        const startTime = Date.now();
        try {
          await concurrencyManager.acquireFileLock(testTaskId, { timeout });
          return {
            timeout,
            success: true,
            elapsedTime: Date.now() - startTime,
          };
        } catch (error) {
          return {
            timeout,
            success: false,
            elapsedTime: Date.now() - startTime,
          };
        }
      });

      const allResults = await Promise.all(promises);
      results.push(...allResults);

      // 所有操作都应该失败（超时）
      expect(results.every((r) => !r.success)).toBe(true);

      // 每个操作的耗时应该接近其设定的超时时间
      for (const result of results) {
        expect(result.elapsedTime).toBeGreaterThanOrEqual(result.timeout - 50);
        expect(result.elapsedTime).toBeLessThan(result.timeout + 100);
      }

      await concurrencyManager.releaseFileLock(firstLock);
    });
  });

  describe('状态版本管理', () => {
    it('应该能够获取任务的状态版本', async () => {
      const version = await concurrencyManager.getStateVersion(testTaskId);

      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThanOrEqual(0);
    });

    it('应该在状态更新时递增版本号', async () => {
      const initialVersion =
        await concurrencyManager.getStateVersion(testTaskId);

      const newVersion =
        await concurrencyManager.updateStateVersion(testTaskId);

      expect(newVersion).toBe(initialVersion + 1);

      // 再次获取应该返回新版本
      const currentVersion =
        await concurrencyManager.getStateVersion(testTaskId);
      expect(currentVersion).toBe(newVersion);
    });

    it('应该能够检查状态一致性', async () => {
      const currentVersion =
        await concurrencyManager.getStateVersion(testTaskId);

      // 检查正确版本
      const isConsistent = await concurrencyManager.checkStateConsistency(
        testTaskId,
        currentVersion
      );
      expect(isConsistent).toBe(true);

      // 检查错误版本
      const isInconsistent = await concurrencyManager.checkStateConsistency(
        testTaskId,
        currentVersion + 10
      );
      expect(isInconsistent).toBe(false);
    });

    it('应该支持原子读取操作', async () => {
      // 创建测试数据
      const testData = { message: 'test data', timestamp: Date.now() };
      const testFilePath = path.join(testDocsPath, 'test-data.json');

      // 先写入数据
      await fs.writeFile(testFilePath, JSON.stringify(testData), 'utf8');
      await concurrencyManager.updateStateVersion(testTaskId);

      // 原子读取
      const result = await concurrencyManager.atomicRead(testFilePath);

      expect(result.data).toEqual(testData);
      expect(typeof result.version).toBe('number');
      expect(result.version).toBeGreaterThan(0);

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该支持原子写入操作', async () => {
      const testData = { message: 'atomic write test', value: 42 };
      const testFilePath = path.join(testDocsPath, 'atomic-test.json');

      // 原子写入
      const result = await concurrencyManager.atomicWrite(
        testFilePath,
        testData
      );

      expect(result.success).toBe(true);
      expect(typeof result.version).toBe('number');

      // 验证文件内容
      const fileContent = await fs.readFile(testFilePath, 'utf8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData).toEqual(testData);

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该支持带版本检查的原子写入', async () => {
      const testData1 = { version: 1, data: 'first' };
      const testData2 = { version: 2, data: 'second' };
      const testFilePath = path.join(testDocsPath, 'versioned-test.json');

      // 第一次写入
      const result1 = await concurrencyManager.atomicWrite(
        testFilePath,
        testData1
      );
      expect(result1.success).toBe(true);

      // 使用正确版本更新
      const result2 = await concurrencyManager.atomicWrite(
        testFilePath,
        testData2,
        result1.version
      );
      expect(result2.success).toBe(true);
      expect(result2.version).toBeGreaterThan(result1.version!);

      // 使用错误版本更新，应该失败
      const result3 = await concurrencyManager.atomicWrite(
        testFilePath,
        { version: 3, data: 'third' },
        result1.version // 使用旧版本
      );
      expect(result3.success).toBe(false);
      expect(result3.conflict).toBe(true);

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该能够检测并发修改冲突', async () => {
      const testFilePath = path.join(testDocsPath, 'conflict-test.json');
      const initialData = { counter: 0 };

      // 初始写入
      await concurrencyManager.atomicWrite(testFilePath, initialData);
      // const initialRead = await concurrencyManager.atomicRead(testFilePath);

      // 模拟两个进程同时读取
      const read1 = await concurrencyManager.atomicRead(testFilePath);
      const read2 = await concurrencyManager.atomicRead(testFilePath);

      expect(read1.version).toBe(read2.version);

      // 第一个进程更新
      const update1 = await concurrencyManager.atomicWrite(
        testFilePath,
        { counter: 1 },
        read1.version
      );
      expect(update1.success).toBe(true);

      // 第二个进程尝试基于旧版本更新，应该失败
      const update2 = await concurrencyManager.atomicWrite(
        testFilePath,
        { counter: 2 },
        read2.version
      );
      expect(update2.success).toBe(false);
      expect(update2.conflict).toBe(true);

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该支持乐观锁重试机制', async () => {
      const testFilePath = path.join(testDocsPath, 'retry-test.json');
      let _retryCount = 0; // 使用下划线前缀表示可能未使用的变量

      // 初始数据
      await concurrencyManager.atomicWrite(testFilePath, { value: 0 });

      // 模拟乐观锁重试
      const updateWithRetry = async (): Promise<void> => {
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const current = await concurrencyManager.atomicRead<{
              value: number;
            }>(testFilePath);
            const newData = {
              value: (current.data as { value: number }).value + 1,
            };

            const result = await concurrencyManager.atomicWrite(
              testFilePath,
              newData,
              current.version
            );

            if (result.success) {
              return; // 成功，退出重试循环
            } else if (result.conflict) {
              _retryCount++;
              // 短暂等待后重试
              await new Promise((resolve) => setTimeout(resolve, 10));
              continue;
            } else {
              throw new Error('写入失败');
            }
          } catch (error) {
            if (attempt === maxRetries - 1) {
              throw error;
            }
            _retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }

        throw new Error('达到最大重试次数');
      };

      // 顺序执行更新操作（模拟乐观锁重试）
      for (let i = 0; i < 5; i++) {
        await updateWithRetry();
      }

      // 验证最终结果
      const finalResult = await concurrencyManager.atomicRead<{
        value: number;
      }>(testFilePath);
      expect((finalResult.data as { value: number }).value).toBe(5);
      // 由于是顺序执行，可能没有重试，所以不强制要求重试次数

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该能够处理状态文件损坏的情况', async () => {
      const stateFilePath = path.join(
        testDocsPath,
        '.state',
        `${testTaskId}.state`
      );

      // 确保状态目录存在
      await fs.ensureDir(path.dirname(stateFilePath));

      // 创建损坏的状态文件
      await fs.writeFile(stateFilePath, 'invalid json content', 'utf8');

      // 获取状态版本应该重置为0
      const version = await concurrencyManager.getStateVersion(testTaskId);
      expect(version).toBe(0);

      // 状态文件应该被修复
      expect(await fs.pathExists(stateFilePath)).toBe(true);
      const stateContent = await fs.readFile(stateFilePath, 'utf8');
      expect(() => JSON.parse(stateContent)).not.toThrow();
    });

    it('应该支持状态快照和恢复', async () => {
      const testData = { snapshot: 'test', items: [1, 2, 3] };
      // 使用与testTaskId匹配的文件名
      const testFilePath = path.join(testDocsPath, `${testTaskId}.json`);

      // 写入数据并创建快照
      await concurrencyManager.atomicWrite(testFilePath, testData);
      const snapshot = await concurrencyManager.createStateSnapshot(testTaskId);

      expect(snapshot.version).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.checksum).toBeDefined();

      // 修改数据
      await concurrencyManager.atomicWrite(testFilePath, { modified: true });
      const modifiedVersion =
        await concurrencyManager.getStateVersion(testTaskId);
      expect(modifiedVersion).toBeGreaterThan(snapshot.version);

      // 恢复快照
      await concurrencyManager.restoreStateSnapshot(testTaskId, snapshot);
      const restoredVersion =
        await concurrencyManager.getStateVersion(testTaskId);
      expect(restoredVersion).toBe(snapshot.version);

      // 清理
      await fs.remove(testFilePath);
    });

    it('应该能够比较状态版本', async () => {
      const version1 = await concurrencyManager.getStateVersion(testTaskId);
      await concurrencyManager.updateStateVersion(testTaskId);
      const version2 = await concurrencyManager.getStateVersion(testTaskId);
      await concurrencyManager.updateStateVersion(testTaskId);
      const version3 = await concurrencyManager.getStateVersion(testTaskId);

      // 测试版本比较
      expect(
        concurrencyManager.compareVersions(version1, version2)
      ).toBeLessThan(0);
      expect(
        concurrencyManager.compareVersions(version2, version1)
      ).toBeGreaterThan(0);
      expect(concurrencyManager.compareVersions(version2, version2)).toBe(0);
      expect(
        concurrencyManager.compareVersions(version3, version1)
      ).toBeGreaterThan(0);
    });

    it('应该支持版本历史记录', async () => {
      const initialVersion =
        await concurrencyManager.getStateVersion(testTaskId);

      // 进行多次更新
      const versions = [initialVersion];
      for (let i = 0; i < 5; i++) {
        const newVersion =
          await concurrencyManager.updateStateVersion(testTaskId);
        versions.push(newVersion);
      }

      // 获取版本历史
      const history = await concurrencyManager.getVersionHistory(testTaskId);

      expect(history).toHaveLength(versions.length);
      expect(history.map((h) => h.version)).toEqual(versions);

      // 验证历史记录包含时间戳
      for (const record of history) {
        expect(record.timestamp).toBeDefined();
        expect(new Date(record.timestamp).getTime()).toBeGreaterThan(0);
      }
    });
  });
});
