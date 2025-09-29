#!/usr/bin/env node

/**
 * Schema 验证脚本
 * 验证 JSON 示例文件是否符合对应的 Schema 定义
 */

import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// 配置文件路径
const SCHEMAS_DIR = 'schemas';
const EXAMPLES_DIR = 'schemas/examples';

// Schema 和示例文件的映射关系
const SCHEMA_EXAMPLE_MAPPING = [
  {
    schema: 'current_task_read_response.schema.json',
    examples: ['current_task_read_response.json'],
  },
  {
    schema: 'current_task_update_request.schema.json',
    examples: ['current_task_update_request.json'],
  },
  {
    schema: 'current_task_update_response.schema.json',
    examples: ['current_task_update_response.json'],
  },
  {
    schema: 'current_task_modify_request.schema.json',
    examples: ['current_task_modify_request.json'],
  },
  {
    schema: 'current_task_modify_response.schema.json',
    examples: ['current_task_modify_response.json'],
  },
  {
    schema: 'current_task_complete_request.schema.json',
    examples: ['current_task_complete_request.json'],
  },
  {
    schema: 'current_task_complete_response.schema.json',
    examples: ['current_task_complete_response.json'],
  },
];

// 错误的示例数据（用于测试反例）
const NEGATIVE_EXAMPLES = [
  {
    name: 'current_task_read_response_invalid.json',
    schema: 'current_task_read_response.schema.json',
    data: {
      // 缺少必填字段 task
      evr_ready: true,
      evr_summary: {
        total: 0,
        passed: [],
        skipped: [],
        failed: [],
        unknown: [],
        unreferenced: [],
      },
      evr_details: [],
      panel_pending: false,
      logs_highlights: [],
      logs_full_count: 0,
      md_version: 'v1.0.0',
    },
    expectedErrors: ["must have required property 'task'"],
  },
  {
    name: 'current_task_update_request_invalid.json',
    schema: 'current_task_update_request.schema.json',
    data: {
      update_type: 'invalid_type', // 无效的枚举值
      status: 'completed',
    },
    expectedErrors: ['must be equal to one of the allowed values'],
  },
  {
    name: 'current_task_modify_request_invalid.json',
    schema: 'current_task_modify_request.schema.json',
    data: {
      field: 'evr',
      content: {
        items: [], // 空数组，违反 minItems: 1
      },
      reason: 'test',
      change_type: 'plan_adjustment',
    },
    expectedErrors: ['must NOT have fewer than 1 items'],
  },
];

/**
 * 加载 JSON 文件
 */
async function loadJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load JSON file ${filePath}: ${error.message}`);
  }
}

/**
 * 验证单个示例文件
 */
async function validateExample(schemaPath, examplePath) {
  console.log(
    `\n📋 Validating ${path.basename(examplePath)} against ${path.basename(schemaPath)}`
  );

  try {
    // 加载 Schema 和示例数据
    const schema = await loadJson(schemaPath);
    const example = await loadJson(examplePath);

    // 编译 Schema
    const validate = ajv.compile(schema);

    // 验证示例数据
    const valid = validate(example);

    if (valid) {
      console.log(`✅ Valid: ${path.basename(examplePath)}`);
      return { valid: true, errors: [] };
    } else {
      console.log(`❌ Invalid: ${path.basename(examplePath)}`);
      console.log('Errors:');
      validate.errors.forEach((error, index) => {
        console.log(
          `  ${index + 1}. ${error.instancePath || 'root'}: ${error.message}`
        );
        if (error.allowedValues) {
          console.log(`     Allowed values: ${error.allowedValues.join(', ')}`);
        }
      });
      return { valid: false, errors: validate.errors };
    }
  } catch (error) {
    console.log(
      `💥 Error validating ${path.basename(examplePath)}: ${error.message}`
    );
    return { valid: false, errors: [{ message: error.message }] };
  }
}

/**
 * 验证反例（应该失败的示例）
 */
async function validateNegativeExample(negativeExample) {
  console.log(`\n🚫 Testing negative example: ${negativeExample.name}`);

  try {
    const schemaPath = path.join(SCHEMAS_DIR, negativeExample.schema);
    const schema = await loadJson(schemaPath);

    // 为反例创建新的 AJV 实例以避免 schema ID 冲突
    const negativeAjv = new Ajv({ allErrors: true, verbose: true });
    addFormats(negativeAjv);

    // 编译 Schema
    const validate = negativeAjv.compile(schema);

    // 验证反例数据（应该失败）
    const valid = validate(negativeExample.data);

    if (!valid) {
      console.log(`✅ Correctly rejected: ${negativeExample.name}`);

      // 检查是否包含预期的错误
      const errorMessages = validate.errors.map((err) => err.message);
      const hasExpectedErrors = negativeExample.expectedErrors.some(
        (expectedError) =>
          errorMessages.some((actualError) =>
            actualError.includes(expectedError)
          )
      );

      if (hasExpectedErrors) {
        console.log(`✅ Contains expected error patterns`);
        return { valid: true, errors: [] };
      } else {
        console.log(`⚠️  Missing expected error patterns:`);
        negativeExample.expectedErrors.forEach((expected) => {
          console.log(`     Expected: ${expected}`);
        });
        console.log(`     Actual errors:`);
        validate.errors.forEach((error) => {
          console.log(
            `     - ${error.instancePath || 'root'}: ${error.message}`
          );
        });
        return { valid: false, errors: validate.errors };
      }
    } else {
      console.log(`❌ Should have failed but passed: ${negativeExample.name}`);
      return {
        valid: false,
        errors: [{ message: 'Negative example should have failed validation' }],
      };
    }
  } catch (error) {
    console.log(
      `💥 Error testing negative example ${negativeExample.name}: ${error.message}`
    );
    return { valid: false, errors: [{ message: error.message }] };
  }
}

/**
 * 检查字段名风格
 */
function checkFieldNaming(obj, path = 'root') {
  const errors = [];

  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        errors.push(...checkFieldNaming(item, `${path}[${index}]`));
      });
    } else {
      Object.keys(obj).forEach((key) => {
        // 检查是否使用了 camelCase（应该使用 snake_case）
        if (/[A-Z]/.test(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: `Field name "${key}" uses camelCase, should use snake_case`,
            suggestion: key.replace(
              /[A-Z]/g,
              (letter) => `_${letter.toLowerCase()}`
            ),
          });
        }

        // 递归检查嵌套对象
        errors.push(...checkFieldNaming(obj[key], `${path}.${key}`));
      });
    }
  }

  return errors;
}

/**
 * 验证字段命名风格
 */
async function validateFieldNaming(examplePath) {
  console.log(`\n🔤 Checking field naming in ${path.basename(examplePath)}`);

  try {
    const example = await loadJson(examplePath);
    const namingErrors = checkFieldNaming(example);

    if (namingErrors.length === 0) {
      console.log(`✅ All field names use snake_case`);
      return { valid: true, errors: [] };
    } else {
      console.log(`❌ Found camelCase field names:`);
      namingErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.path}: ${error.message}`);
        console.log(`     Suggestion: ${error.suggestion}`);
      });
      return { valid: false, errors: namingErrors };
    }
  } catch (error) {
    console.log(`💥 Error checking field naming: ${error.message}`);
    return { valid: false, errors: [{ message: error.message }] };
  }
}

/**
 * 主验证函数
 */
async function main() {
  console.log('🔍 Starting Schema Validation');
  console.log('=====================================');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // 验证正例（应该通过的示例）
  console.log('\n📝 Validating positive examples...');
  for (const mapping of SCHEMA_EXAMPLE_MAPPING) {
    const schemaPath = path.join(SCHEMAS_DIR, mapping.schema);

    for (const exampleFile of mapping.examples) {
      const examplePath = path.join(EXAMPLES_DIR, exampleFile);

      // 检查文件是否存在
      if (!(await fs.pathExists(schemaPath))) {
        console.log(`❌ Schema file not found: ${schemaPath}`);
        totalTests++;
        failedTests++;
        continue;
      }

      if (!(await fs.pathExists(examplePath))) {
        console.log(`❌ Example file not found: ${examplePath}`);
        totalTests++;
        failedTests++;
        continue;
      }

      // 验证 Schema
      const result = await validateExample(schemaPath, examplePath);
      totalTests++;

      if (result.valid) {
        passedTests++;
      } else {
        failedTests++;
      }

      // 验证字段命名风格
      const namingResult = await validateFieldNaming(examplePath);
      totalTests++;

      if (namingResult.valid) {
        passedTests++;
      } else {
        failedTests++;
      }
    }
  }

  // 验证反例（应该失败的示例）
  console.log('\n🚫 Testing negative examples...');
  for (const negativeExample of NEGATIVE_EXAMPLES) {
    const result = await validateNegativeExample(negativeExample);
    totalTests++;

    if (result.valid) {
      passedTests++;
    } else {
      failedTests++;
    }
  }

  // 输出总结
  console.log('\n📊 Validation Summary');
  console.log('=====================================');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.log('\n❌ Schema validation failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All schema validations passed!');
    process.exit(0);
  }
}

// 运行验证
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
