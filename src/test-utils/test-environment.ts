/**
 * 测试环境管理器
 * 解决测试间歇性失败问题，提供可靠的测试环境隔离
 */

import fs from 'fs-extra';
import path from 'path';
import { ulid } from 'ulid';

export class TestEnvironmentManager {
  private testDir: string;
  private isSetup = false;

  constructor(testSuiteName?: string) {
    // 为每个测试套件创建唯一的目录，避免并发冲突
    const uniqueId = ulid().toLowerCase();
    const suiteName = testSuiteName || 'test';
    this.testDir = path.join(process.cwd(), `.test-${suiteName}-${uniqueId}`);
  }

  /**
   * 获取测试目录路径
   */
  getTestDir(): string {
    return this.testDir;
  }

  /**
   * 设置测试环境
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    try {
      // 确保测试目录不存在
      await this.cleanup();

      // 创建测试目录
      await this.ensureTestDir();

      this.isSetup = true;
    } catch (error) {
      throw new Error(
        `测试环境设置失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 清理测试环境
   */
  async cleanup(): Promise<void> {
    try {
      if (await fs.pathExists(this.testDir)) {
        // 使用重试机制确保删除成功
        await this.retryOperation(
          async () => {
            await fs.remove(this.testDir);
          },
          3,
          50
        );
      }
    } catch (error) {
      console.warn(
        `测试环境清理警告: ${error instanceof Error ? error.message : String(error)}`
      );
      // 清理失败不应该阻止测试继续
    }
    this.isSetup = false;
  }

  /**
   * 重置测试环境（清理后重新设置）
   */
  async reset(): Promise<void> {
    await this.cleanup();
    await this.setup();
  }

  /**
   * 确保测试目录存在
   */
  private async ensureTestDir(): Promise<void> {
    await this.retryOperation(
      async () => {
        await fs.ensureDir(this.testDir);

        // 验证目录确实存在且可访问
        const stats = await fs.stat(this.testDir);
        if (!stats.isDirectory()) {
          throw new Error('测试目录创建失败：不是目录');
        }
      },
      3,
      50
    );
  }

  /**
   * 重试操作机制
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delayMs: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (i < maxRetries) {
          // 指数退避延迟
          const delay = delayMs * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('重试操作失败');
  }

  /**
   * 等待文件系统操作稳定
   */
  async waitForStable(): Promise<void> {
    // 等待文件系统操作完成
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * 创建测试环境管理器的便捷函数
 */
export function createTestEnvironment(
  testSuiteName?: string
): TestEnvironmentManager {
  return new TestEnvironmentManager(testSuiteName);
}
