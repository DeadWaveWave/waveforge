/**
 * MCP 工具测试用例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthTool, PingTool } from './index.js';
import { ProjectRootInfo } from '../types/index.js';

describe('HealthTool', () => {
  let healthTool: HealthTool;
  let mockProjectRoot: ProjectRootInfo;
  const startTime = Date.now() - 5000; // 5秒前启动

  beforeEach(() => {
    mockProjectRoot = {
      root: '/test/project',
      source: 'cwd_fallback',
      available: true,
    };
    healthTool = new HealthTool(startTime, mockProjectRoot);
  });

  it('应该返回健康状态信息', async () => {
    const result = await healthTool.handle();
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response).toMatchObject({
      success: true,
      status: 'healthy',
      version: '0.1.0',
    });
    
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('uptime');
    expect(response.uptime).toBeGreaterThan(0);
    
    expect(response.data).toMatchObject({
      server: 'waveforge-mcp-task-management',
      capabilities: ['tools', 'roots'],
      projectRoot: mockProjectRoot,
    });
    
    expect(response.data.environment).toHaveProperty('nodeVersion');
    expect(response.data.environment).toHaveProperty('platform');
    expect(response.data.environment).toHaveProperty('arch');
    
    expect(response.data.memory).toHaveProperty('used');
    expect(response.data.memory).toHaveProperty('total');
    expect(typeof response.data.memory.used).toBe('number');
    expect(typeof response.data.memory.total).toBe('number');
  });

  it('应该处理空项目根目录', async () => {
    const healthToolWithoutRoot = new HealthTool(startTime, null);
    const result = await healthToolWithoutRoot.handle();
    
    const response = JSON.parse(result.content[0].text);
    expect(response.data.projectRoot).toBeNull();
  });

  it('应该返回正确的工具定义', () => {
    const definition = HealthTool.getDefinition();
    
    expect(definition).toMatchObject({
      name: 'health',
      description: expect.stringContaining('检查服务器健康状态'),
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    });
  });
});

describe('PingTool', () => {
  let pingTool: PingTool;

  beforeEach(() => {
    pingTool = new PingTool();
  });

  it('应该处理不带消息的 ping 请求', async () => {
    const result = await pingTool.handle({});
    
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response).toMatchObject({
      success: true,
      message: 'pong',
      echo: null,
      server: 'waveforge-mcp-task-management',
      version: '0.1.0',
    });
    
    expect(response).toHaveProperty('timestamp');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data).toHaveProperty('latency');
    expect(response.data.requestId).toMatch(/^ping_\d+_[a-z0-9]+$/);
  });

  it('应该回显提供的消息', async () => {
    const testMessage = 'Hello, World!';
    const result = await pingTool.handle({ message: testMessage });
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response.echo).toBe(testMessage);
    expect(response.success).toBe(true);
    expect(response.message).toBe('pong');
  });

  it('应该验证消息长度', async () => {
    const longMessage = 'a'.repeat(1001); // 超过1000字符限制
    const result = await pingTool.handle({ message: longMessage });
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('消息长度不能超过 1000 个字符');
    expect(response.type).toBe('VALIDATION_ERROR');
  });

  it('应该拒绝包含控制字符的消息', async () => {
    const messageWithControlChar = 'Hello\x00World'; // 包含空字符
    const result = await pingTool.handle({ message: messageWithControlChar });
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('消息不能包含控制字符');
    expect(response.type).toBe('VALIDATION_ERROR');
  });

  it('应该验证消息类型', async () => {
    const result = await pingTool.handle({ message: 123 as any });
    
    const response = JSON.parse(result.content[0].text);
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('参数类型错误');
    expect(response.type).toBe('VALIDATION_ERROR');
  });

  it('应该生成唯一的请求ID', async () => {
    const result1 = await pingTool.handle({});
    const result2 = await pingTool.handle({});
    
    const response1 = JSON.parse(result1.content[0].text);
    const response2 = JSON.parse(result2.content[0].text);
    
    expect(response1.data.requestId).not.toBe(response2.data.requestId);
  });

  it('应该返回正确的工具定义', () => {
    const definition = PingTool.getDefinition();
    
    expect(definition).toMatchObject({
      name: 'ping',
      description: expect.stringContaining('测试服务器连接'),
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: expect.stringContaining('可选的测试消息'),
            maxLength: 1000,
          },
        },
        additionalProperties: false,
      },
    });
  });
});

describe('工具集成测试', () => {
  it('所有工具都应该有一致的错误响应格式', async () => {
    const pingTool = new PingTool();
    
    // 触发验证错误
    const result = await pingTool.handle({ message: 'a'.repeat(1001) });
    const response = JSON.parse(result.content[0].text);
    
    // 验证错误响应格式
    expect(response).toHaveProperty('success', false);
    expect(response).toHaveProperty('error');
    expect(response).toHaveProperty('type');
    expect(response).toHaveProperty('timestamp');
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('所有工具都应该有正确的定义格式', () => {
    const healthDef = HealthTool.getDefinition();
    const pingDef = PingTool.getDefinition();
    
    [healthDef, pingDef].forEach(def => {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('inputSchema');
      expect(def.inputSchema).toHaveProperty('type', 'object');
      expect(def.inputSchema).toHaveProperty('additionalProperties', false);
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');
    });
  });
});