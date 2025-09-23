/**
 * 项目管理相关的 MCP 工具
 * 实现 project_bind 和 project_info 工具
 */

import { ProjectManager } from '../core/project-manager.js';
import { logger } from '../core/logger.js';
import {
  LogCategory,
  LogAction,
  type ProjectBindParams,
} from '../types/index.js';

/**
 * project_bind 工具
 * 绑定项目到当前连接
 */
export class ProjectBindTool {
  private projectManager: ProjectManager;

  constructor(projectManager: ProjectManager) {
    this.projectManager = projectManager;
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: 'project_bind',
      description:
        '绑定项目到当前连接，提供稳定项目标识，确保文件写入项目根目录下的.wave文件夹中',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: {
            type: 'string' as const,
            description: '项目ID（可选，与project_path二选一）',
          },
          project_path: {
            type: 'string' as const,
            description: '项目路径（可选，与project_id二选一）',
          },
        },
        additionalProperties: false,
        oneOf: [{ required: ['project_id'] }, { required: ['project_path'] }],
      },
    };
  }

  /**
   * 处理工具调用
   */
  async handle(
    params: ProjectBindParams
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      // 验证参数
      this.validateParams(params);

      // 调用项目管理器进行实际绑定
      const result = await this.projectManager.bindProject(params);

      const response = {
        success: true,
        message: '项目绑定成功',
        data: result,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: '项目绑定失败',
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParams(params: ProjectBindParams): void {
    if (!params.project_id && !params.project_path) {
      throw new Error('必须提供 project_id 或 project_path 参数');
    }

    if (params.project_id && params.project_path) {
      throw new Error('project_id 和 project_path 参数不能同时提供');
    }

    if (params.project_id) {
      if (
        typeof params.project_id !== 'string' ||
        params.project_id.trim() === ''
      ) {
        throw new Error('project_id 必须是非空字符串');
      }
    }

    if (params.project_path) {
      if (
        typeof params.project_path !== 'string' ||
        params.project_path.trim() === ''
      ) {
        throw new Error('project_path 必须是非空字符串');
      }
    }
  }
}

/**
 * project_info 工具
 * 获取当前活跃项目信息
 */
export class ProjectInfoTool {
  private projectManager: ProjectManager;

  constructor(projectManager: ProjectManager) {
    this.projectManager = projectManager;
  }

  /**
   * 获取工具定义
   */
  static getDefinition() {
    return {
      name: 'project_info',
      description: '获取当前连接的活跃项目信息',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        additionalProperties: false,
      },
    };
  }

  /**
   * 处理工具调用
   */
  async handle(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const timer = logger.createTimer('project-info');

      // 获取项目信息
      const result = await this.projectManager.getProjectInfo();

      timer.end(
        LogCategory.Task,
        LogAction.Handle,
        'project_info 工具执行完成'
      );

      // 格式化响应
      const response = {
        success: true,
        message: '获取项目信息成功',
        data: result,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error(
        LogCategory.Task,
        LogAction.Handle,
        'project_info 工具执行失败',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: '获取项目信息失败',
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }
}
