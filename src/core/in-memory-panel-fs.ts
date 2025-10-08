/**
 * InMemoryPanelFS - 内存文件系统模拟
 * 用于测试面板解析器，不依赖真实文件系统
 */

import { ParseError } from './error-handler.js';

/**
 * 内存文件节点
 */
interface MemoryFileNode {
  type: 'file' | 'directory';
  content?: string;
  children?: Map<string, MemoryFileNode>;
  createdAt: Date;
  modifiedAt: Date;
  size: number;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  ctime: Date;
}

/**
 * 内存文件统计信息实现
 */
class MemoryFileStats implements FileStats {
  constructor(private node: MemoryFileNode) { }

  isFile(): boolean {
    return this.node.type === 'file';
  }

  isDirectory(): boolean {
    return this.node.type === 'directory';
  }

  get size(): number {
    return this.node.size;
  }

  get mtime(): Date {
    return this.node.modifiedAt;
  }

  get ctime(): Date {
    return this.node.createdAt;
  }
}

/**
 * 内存面板文件系统
 */
export class InMemoryPanelFS {
  private root: MemoryFileNode;
  private currentPath: string = '/';

  constructor() {
    this.root = {
      type: 'directory',
      children: new Map(),
      createdAt: new Date(),
      modifiedAt: new Date(),
      size: 0,
    };
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<string> {
    const node = this.getNode(filePath);

    if (!node) {
      throw new ParseError(`文件不存在: ${filePath}`, {
        path: filePath,
        operation: 'readFile',
      });
    }

    if (node.type !== 'file') {
      throw new ParseError(`路径不是文件: ${filePath}`, {
        path: filePath,
        operation: 'readFile',
        nodeType: node.type,
      });
    }

    return node.content || '';
  }

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const parentPath = this.getParentPath(filePath);
    const fileName = this.getFileName(filePath);

    // 确保父目录存在
    await this.ensureDirectory(parentPath);

    const parentNode = this.getNode(parentPath);
    if (!parentNode || !parentNode.children) {
      throw new ParseError(`父目录不存在: ${parentPath}`, {
        path: filePath,
        operation: 'writeFile',
      });
    }

    const now = new Date();
    const fileNode: MemoryFileNode = {
      type: 'file',
      content,
      createdAt: parentNode.children.has(fileName)
        ? parentNode.children.get(fileName)!.createdAt
        : now,
      modifiedAt: now,
      size: content.length,
    };

    parentNode.children.set(fileName, fileNode);
    parentNode.modifiedAt = now;
  }

  /**
   * 检查文件或目录是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    return this.getNode(filePath) !== null;
  }

  /**
   * 获取文件统计信息
   */
  async stat(filePath: string): Promise<FileStats> {
    const node = this.getNode(filePath);

    if (!node) {
      throw new ParseError(`文件或目录不存在: ${filePath}`, {
        path: filePath,
        operation: 'stat',
      });
    }

    return new MemoryFileStats(node);
  }

  /**
   * 创建目录
   */
  async mkdir(
    dirPath: string,
    options?: { recursive?: boolean }
  ): Promise<void> {
    if (options?.recursive) {
      await this.ensureDirectory(dirPath);
    } else {
      const parentPath = this.getParentPath(dirPath);
      const dirName = this.getFileName(dirPath);

      const parentNode = this.getNode(parentPath);
      if (!parentNode || parentNode.type !== 'directory') {
        throw new ParseError(`父目录不存在: ${parentPath}`, {
          path: dirPath,
          operation: 'mkdir',
        });
      }

      if (parentNode.children!.has(dirName)) {
        throw new ParseError(`目录已存在: ${dirPath}`, {
          path: dirPath,
          operation: 'mkdir',
        });
      }

      const now = new Date();
      const dirNode: MemoryFileNode = {
        type: 'directory',
        children: new Map(),
        createdAt: now,
        modifiedAt: now,
        size: 0,
      };

      parentNode.children!.set(dirName, dirNode);
      parentNode.modifiedAt = now;
    }
  }

  /**
   * 读取目录内容
   */
  async readdir(dirPath: string): Promise<string[]> {
    const node = this.getNode(dirPath);

    if (!node) {
      throw new ParseError(`目录不存在: ${dirPath}`, {
        path: dirPath,
        operation: 'readdir',
      });
    }

    if (node.type !== 'directory') {
      throw new ParseError(`路径不是目录: ${dirPath}`, {
        path: dirPath,
        operation: 'readdir',
        nodeType: node.type,
      });
    }

    return Array.from(node.children!.keys());
  }

  /**
   * 删除文件或目录
   */
  async remove(filePath: string): Promise<void> {
    const parentPath = this.getParentPath(filePath);
    const fileName = this.getFileName(filePath);

    const parentNode = this.getNode(parentPath);
    if (!parentNode || !parentNode.children) {
      throw new ParseError(`父目录不存在: ${parentPath}`, {
        path: filePath,
        operation: 'remove',
      });
    }

    if (!parentNode.children.has(fileName)) {
      throw new ParseError(`文件或目录不存在: ${filePath}`, {
        path: filePath,
        operation: 'remove',
      });
    }

    parentNode.children.delete(fileName);
    parentNode.modifiedAt = new Date();
  }

  /**
   * 复制文件
   */
  async copy(srcPath: string, destPath: string): Promise<void> {
    const srcNode = this.getNode(srcPath);
    if (!srcNode) {
      throw new ParseError(`源文件不存在: ${srcPath}`, {
        path: srcPath,
        operation: 'copy',
      });
    }

    if (srcNode.type === 'file') {
      await this.writeFile(destPath, srcNode.content || '');
    } else {
      await this.mkdir(destPath, { recursive: true });

      for (const [childName, _childNode] of srcNode.children!) {
        const srcChildPath = this.joinPath(srcPath, childName);
        const destChildPath = this.joinPath(destPath, childName);
        await this.copy(srcChildPath, destChildPath);
      }
    }
  }

  /**
   * 移动文件或目录
   */
  async move(srcPath: string, destPath: string): Promise<void> {
    await this.copy(srcPath, destPath);
    await this.remove(srcPath);
  }

  /**
   * 获取当前工作目录
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * 改变当前工作目录
   */
  async chdir(dirPath: string): Promise<void> {
    const node = this.getNode(dirPath);

    if (!node) {
      throw new ParseError(`目录不存在: ${dirPath}`, {
        path: dirPath,
        operation: 'chdir',
      });
    }

    if (node.type !== 'directory') {
      throw new ParseError(`路径不是目录: ${dirPath}`, {
        path: dirPath,
        operation: 'chdir',
        nodeType: node.type,
      });
    }

    this.currentPath = this.normalizePath(dirPath);
  }

  /**
   * 清空文件系统
   */
  clear(): void {
    this.root = {
      type: 'directory',
      children: new Map(),
      createdAt: new Date(),
      modifiedAt: new Date(),
      size: 0,
    };
    this.currentPath = '/';
  }

  /**
   * 获取文件系统树结构（用于调试）
   */
  getTree(): any {
    return this.nodeToTree(this.root, '/');
  }

  /**
   * 预设测试数据
   */
  async setupTestData(): Promise<void> {
    // 创建测试目录结构
    await this.mkdir('/.wave', { recursive: true });
    await this.mkdir('/.wave/tasks', { recursive: true });
    await this.mkdir('/.wave/history', { recursive: true });
    await this.mkdir('/.wave/templates', { recursive: true });

    // 创建测试面板文件
    const testPanelContent = `# 测试任务

## 验收标准

这是一个测试任务的验收标准。

## 整体计划

1. [x] 完成第一个计划 <!-- plan:plan-1 -->
   > 这是第一个计划的提示
   - [ref] docs/api.md
   - [evr] evr-001

   - [x] 完成第一个步骤 <!-- step:step-1-1 -->
   - [-] 进行第二个步骤 <!-- step:step-1-2 -->

2. [-] 进行第二个计划 <!-- plan:plan-2 -->
   - [ ] 待办第一个步骤
   - [ ] 待办第二个步骤

3. [ ] 待办第三个计划
   - [!] 阻塞的步骤

## EVR 预期结果

1. [x] EVR-001 基础功能验证 <!-- evr:evr-001 -->

   - [verify] 运行测试套件
   - [expect] 所有测试通过
   - [status] pass
   - [class] runtime

## 关键日志

- **2025-09-29 12:00:00** [INFO] 任务开始
- **2025-09-29 12:30:00** [INFO] 第一个计划完成
`;

    await this.writeFile('/.wave/current-task.md', testPanelContent);

    // 创建测试配置文件
    const testConfig = {
      id: 'test-task-001',
      title: '测试任务',
      created_at: new Date().toISOString(),
    };

    await this.writeFile(
      '/.wave/current-task.json',
      JSON.stringify(testConfig, null, 2)
    );
  }

  // 私有辅助方法

  /**
   * 获取节点
   */
  private getNode(filePath: string): MemoryFileNode | null {
    const normalizedPath = this.normalizePath(filePath);
    const parts = normalizedPath.split('/').filter((part) => part !== '');

    let currentNode = this.root;

    for (const part of parts) {
      if (!currentNode.children || !currentNode.children.has(part)) {
        return null;
      }
      currentNode = currentNode.children.get(part)!;
    }

    return currentNode;
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);
    const parts = normalizedPath.split('/').filter((part) => part !== '');

    let currentNode = this.root;
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath === '' ? part : `${currentPath}/${part}`;

      if (!currentNode.children!.has(part)) {
        const now = new Date();
        const dirNode: MemoryFileNode = {
          type: 'directory',
          children: new Map(),
          createdAt: now,
          modifiedAt: now,
          size: 0,
        };
        currentNode.children!.set(part, dirNode);
        currentNode.modifiedAt = now;
      }

      currentNode = currentNode.children!.get(part)!;

      if (currentNode.type !== 'directory') {
        throw new ParseError(`路径不是目录: /${currentPath}`, {
          path: dirPath,
          operation: 'ensureDirectory',
        });
      }
    }
  }

  /**
   * 标准化路径
   */
  private normalizePath(filePath: string): string {
    if (!filePath.startsWith('/')) {
      filePath = this.joinPath(this.currentPath, filePath);
    }

    const parts = filePath.split('/').filter((part) => part !== '');
    const normalizedParts: string[] = [];

    for (const part of parts) {
      if (part === '.') {
        continue;
      } else if (part === '..') {
        if (normalizedParts.length > 0) {
          normalizedParts.pop();
        }
      } else {
        normalizedParts.push(part);
      }
    }

    return '/' + normalizedParts.join('/');
  }

  /**
   * 连接路径
   */
  private joinPath(...parts: string[]): string {
    return parts
      .map((part) => part.replace(/^\/+|\/+$/g, ''))
      .filter((part) => part !== '')
      .join('/');
  }

  /**
   * 获取父目录路径
   */
  private getParentPath(filePath: string): string {
    const normalizedPath = this.normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');

    if (lastSlashIndex === 0) {
      return '/';
    }

    return normalizedPath.substring(0, lastSlashIndex);
  }

  /**
   * 获取文件名
   */
  private getFileName(filePath: string): string {
    const normalizedPath = this.normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');

    return normalizedPath.substring(lastSlashIndex + 1);
  }

  /**
   * 将节点转换为树结构（用于调试）
   */
  private nodeToTree(node: MemoryFileNode, path: string): any {
    if (node.type === 'file') {
      return {
        type: 'file',
        path,
        size: node.size,
        content:
          node.content?.substring(0, 100) +
          (node.content && node.content.length > 100 ? '...' : ''),
        createdAt: node.createdAt,
        modifiedAt: node.modifiedAt,
      };
    } else {
      const children: any = {};
      for (const [name, childNode] of node.children!) {
        const childPath = path === '/' ? `/${name}` : `${path}/${name}`;
        children[name] = this.nodeToTree(childNode, childPath);
      }

      return {
        type: 'directory',
        path,
        children,
        createdAt: node.createdAt,
        modifiedAt: node.modifiedAt,
      };
    }
  }
}

/**
 * 创建内存面板文件系统实例
 */
export function createInMemoryPanelFS(): InMemoryPanelFS {
  return new InMemoryPanelFS();
}
