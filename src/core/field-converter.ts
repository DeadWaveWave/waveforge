/**
 * 字段名转换工具
 * 实现 camelCase ↔ snake_case 转换
 */

/**
 * 将 camelCase 转换为 snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * 将 snake_case 转换为 camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 递归转换对象的所有键名从 camelCase 到 snake_case
 */
export function convertObjectToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertObjectToSnakeCase);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);
      converted[snakeKey] = convertObjectToSnakeCase(value);
    }
    return converted;
  }

  return obj;
}

/**
 * 递归转换对象的所有键名从 snake_case 到 camelCase
 */
export function convertObjectToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertObjectToCamelCase);
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      converted[camelKey] = convertObjectToCamelCase(value);
    }
    return converted;
  }

  return obj;
}

/**
 * 字段映射表 - camelCase 到 snake_case
 */
export const FIELD_MAPPING: Record<string, string> = {
  // 基础字段
  mdVersion: 'md_version',
  syncPreview: 'sync_preview',
  evrForNode: 'evr_for_node',
  lastRun: 'last_run',
  evrSummary: 'evr_summary',
  evrDetails: 'evr_details',
  evrReady: 'evr_ready',
  panelPending: 'panel_pending',
  logsHighlights: 'logs_highlights',
  logsFullCount: 'logs_full_count',

  // EVR 相关
  evrId: 'evr_id',
  referencedBy: 'referenced_by',
  evrForPlan: 'evr_for_plan',
  evrPending: 'evr_pending',
  evrRequiredFinal: 'evr_required_final',
  evrUnreferenced: 'evr_unreferenced',

  // 任务相关
  taskId: 'task_id',
  planId: 'plan_id',
  stepId: 'step_id',
  currentPlanId: 'current_plan_id',
  currentStepId: 'current_step_id',
  updateType: 'update_type',
  changeType: 'change_type',

  // 计划和步骤字段（保持 description，但在响应格式化时添加 text 别名）
  text: 'text', // 用于兼容旧API，映射到 description

  // 项目相关
  projectId: 'project_id',
  projectPath: 'project_path',
  boundAt: 'bound_at',

  // 时间相关
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  completedAt: 'completed_at',

  // 其他
  affectedSections: 'affected_sections',
  knowledgeRefs: 'knowledge_refs',
  overallPlan: 'overall_plan',
  taskHints: 'task_hints',
  aiNotes: 'ai_notes',
};

/**
 * 反向字段映射表 - snake_case 到 camelCase
 */
export const REVERSE_FIELD_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAPPING).map(([camel, snake]) => [snake, camel])
);

/**
 * 使用预定义映射表转换对象键名
 */
export function convertWithMapping(
  obj: any,
  mapping: Record<string, string>,
  fallbackConverter?: (key: string) => string
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      convertWithMapping(item, mapping, fallbackConverter)
    );
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      let mappedKey = mapping[key];
      if (!mappedKey && fallbackConverter) {
        mappedKey = fallbackConverter(key);
      } else if (!mappedKey) {
        mappedKey = key;
      }
      converted[mappedKey] = convertWithMapping(
        value,
        mapping,
        fallbackConverter
      );
    }
    return converted;
  }

  return obj;
}

/**
 * 转换响应对象到 snake_case（用于 MCP 响应）
 */
export function convertResponseToSnakeCase(obj: any): any {
  return convertWithMapping(obj, FIELD_MAPPING, camelToSnake);
}

/**
 * 转换请求对象到 camelCase（用于内部处理）
 */
export function convertRequestToCamelCase(obj: any): any {
  return convertWithMapping(obj, REVERSE_FIELD_MAPPING, snakeToCamel);
}

/**
 * 验证字段名转换的正确性
 */
export function validateFieldConversion(
  original: any,
  converted: any
): boolean {
  if (typeof original !== 'object' || typeof converted !== 'object') {
    return original === converted;
  }

  if (Array.isArray(original) !== Array.isArray(converted)) {
    return false;
  }

  if (Array.isArray(original)) {
    if (original.length !== converted.length) {
      return false;
    }
    return original.every((item, index) =>
      validateFieldConversion(item, converted[index])
    );
  }

  const originalKeys = Object.keys(original);
  const convertedKeys = Object.keys(converted);

  if (originalKeys.length !== convertedKeys.length) {
    return false;
  }

  return originalKeys.every((key) => {
    const mappedKey = FIELD_MAPPING[key] || camelToSnake(key);
    return (
      Object.prototype.hasOwnProperty.call(converted, mappedKey) &&
      validateFieldConversion(original[key], converted[mappedKey])
    );
  });
}

/**
 * 获取所有支持的字段映射
 */
export function getAllFieldMappings(): Array<{
  camelCase: string;
  snakeCase: string;
}> {
  return Object.entries(FIELD_MAPPING).map(([camelCase, snakeCase]) => ({
    camelCase,
    snakeCase,
  }));
}

/**
 * 检查字段名是否需要转换
 */
export function needsConversion(fieldName: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(FIELD_MAPPING, fieldName) ||
    Object.prototype.hasOwnProperty.call(REVERSE_FIELD_MAPPING, fieldName)
  );
}

/**
 * 获取字段的转换后名称
 */
export function getConvertedFieldName(
  fieldName: string,
  toSnakeCase: boolean = true
): string {
  if (toSnakeCase) {
    return FIELD_MAPPING[fieldName] || camelToSnake(fieldName);
  } else {
    return REVERSE_FIELD_MAPPING[fieldName] || snakeToCamel(fieldName);
  }
}
