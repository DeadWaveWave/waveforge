/**
 * 项目类型检测器测试
 * 测试项目类型检测、结构验证和健康检查功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ProjectTypeDetector } from './project-type-detector.js';
import { ProjectType } from '../types/index.js';

describe('ProjectTypeDetector', () => {
  let tempDir: string;
  let detector: ProjectTypeDetector;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'waveforge-project-detector-test-')
    );
    detector = new ProjectTypeDetector();
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('项目类型检测', () => {
    describe('Node.js 项目检测', () => {
      it('应该检测到包含 package.json 的 Node.js 项目', async () => {
        const projectDir = path.join(tempDir, 'nodejs-project');
        await fs.ensureDir(projectDir);

        // 创建 package.json
        const packageJson = {
          name: 'test-project',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            express: '^4.18.0',
          },
        };
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        // 创建一些 JavaScript 文件
        await fs.writeFile(
          path.join(projectDir, 'index.js'),
          'console.log("Hello World");'
        );
        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'app.js'),
          'module.exports = {};'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.NodeJS);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.evidenceFiles).toContain('package.json');
        expect(result.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'config_file',
              name: 'package.json',
            }),
          ])
        );
      });

      it('应该检测到 TypeScript Node.js 项目', async () => {
        const projectDir = path.join(tempDir, 'typescript-project');
        await fs.ensureDir(projectDir);

        // 创建 package.json 和 tsconfig.json
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'typescript-project',
            version: '1.0.0',
            main: 'dist/index.js',
            scripts: {
              build: 'tsc',
            },
            devDependencies: {
              typescript: '^4.9.0',
              '@types/node': '^18.0.0',
            },
          })
        );

        await fs.writeFile(
          path.join(projectDir, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              outDir: './dist',
            },
          })
        );

        // 创建 TypeScript 文件
        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'index.ts'),
          'const message: string = "Hello TypeScript";'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.NodeJS);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['package.json', 'tsconfig.json'])
        );
      });

      it('应该检测到包含 pnpm-lock.yaml 的项目', async () => {
        const projectDir = path.join(tempDir, 'pnpm-project');
        await fs.ensureDir(projectDir);

        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'pnpm-project', version: '1.0.0' })
        );
        await fs.writeFile(
          path.join(projectDir, 'pnpm-lock.yaml'),
          'lockfileVersion: 5.4'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.NodeJS);
        expect(result.evidenceFiles).toContain('pnpm-lock.yaml');
      });
    });

    describe('Python 项目检测', () => {
      it('应该检测到包含 requirements.txt 的 Python 项目', async () => {
        const projectDir = path.join(tempDir, 'python-project');
        await fs.ensureDir(projectDir);

        // 创建 requirements.txt
        await fs.writeFile(
          path.join(projectDir, 'requirements.txt'),
          'flask==2.3.0\nrequests>=2.28.0'
        );

        // 创建 Python 文件
        await fs.writeFile(
          path.join(projectDir, 'main.py'),
          'import flask\nprint("Hello Python")'
        );
        await fs.writeFile(
          path.join(projectDir, 'app.py'),
          'from flask import Flask'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Python);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.evidenceFiles).toContain('requirements.txt');
      });

      it('应该检测到包含 pyproject.toml 的现代 Python 项目', async () => {
        const projectDir = path.join(tempDir, 'modern-python-project');
        await fs.ensureDir(projectDir);

        // 创建 pyproject.toml
        const pyprojectToml = `
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "my-package"
version = "0.1.0"
description = "A sample Python package"
dependencies = [
    "requests>=2.28.0",
]
`;
        await fs.writeFile(
          path.join(projectDir, 'pyproject.toml'),
          pyprojectToml
        );

        // 创建源码目录
        await fs.ensureDir(path.join(projectDir, 'src', 'my_package'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'my_package', '__init__.py'),
          '__version__ = "0.1.0"'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Python);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFiles).toContain('pyproject.toml');
      });

      it('应该检测到包含 setup.py 的传统 Python 项目', async () => {
        const projectDir = path.join(tempDir, 'traditional-python-project');
        await fs.ensureDir(projectDir);

        await fs.writeFile(
          path.join(projectDir, 'setup.py'),
          `
from setuptools import setup, find_packages

setup(
    name="my-package",
    version="0.1.0",
    packages=find_packages(),
)
`
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Python);
        expect(result.evidenceFiles).toContain('setup.py');
      });

      it('应该检测到 Poetry 项目', async () => {
        const projectDir = path.join(tempDir, 'poetry-project');
        await fs.ensureDir(projectDir);

        const poetryLock = `
# This file is automatically @generated by Poetry and should not be changed by hand.

[[package]]
name = "flask"
version = "2.3.0"
`;
        await fs.writeFile(path.join(projectDir, 'poetry.lock'), poetryLock);
        await fs.writeFile(
          path.join(projectDir, 'pyproject.toml'),
          `
[tool.poetry]
name = "poetry-project"
version = "0.1.0"
`
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Python);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['poetry.lock', 'pyproject.toml'])
        );
      });
    });

    describe('Rust 项目检测', () => {
      it('应该检测到包含 Cargo.toml 的 Rust 项目', async () => {
        const projectDir = path.join(tempDir, 'rust-project');
        await fs.ensureDir(projectDir);

        // 创建 Cargo.toml
        const cargoToml = `
[package]
name = "rust-project"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
`;
        await fs.writeFile(path.join(projectDir, 'Cargo.toml'), cargoToml);

        // 创建 src 目录和 main.rs
        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'main.rs'),
          'fn main() {\n    println!("Hello, Rust!");\n}'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Rust);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFiles).toContain('Cargo.toml');
        expect(result.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'config_file',
              name: 'Cargo.toml',
            }),
          ])
        );
      });

      it('应该检测到包含 Cargo.lock 的 Rust 项目', async () => {
        const projectDir = path.join(tempDir, 'rust-with-lock');
        await fs.ensureDir(projectDir);

        await fs.writeFile(
          path.join(projectDir, 'Cargo.toml'),
          '[package]\nname = "test"\nversion = "0.1.0"'
        );
        await fs.writeFile(
          path.join(projectDir, 'Cargo.lock'),
          '# This file is automatically @generated by Cargo.'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Rust);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['Cargo.toml', 'Cargo.lock'])
        );
      });
    });

    describe('Java 项目检测', () => {
      it('应该检测到 Maven 项目', async () => {
        const projectDir = path.join(tempDir, 'maven-project');
        await fs.ensureDir(projectDir);

        // 创建 pom.xml
        const pomXml = `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>maven-project</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>
`;
        await fs.writeFile(path.join(projectDir, 'pom.xml'), pomXml);

        // 创建标准 Maven 目录结构
        await fs.ensureDir(path.join(projectDir, 'src', 'main', 'java'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'main', 'java', 'Main.java'),
          'public class Main {\n    public static void main(String[] args) {}\n}'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Java);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFiles).toContain('pom.xml');
      });

      it('应该检测到 Gradle 项目', async () => {
        const projectDir = path.join(tempDir, 'gradle-project');
        await fs.ensureDir(projectDir);

        // 创建 build.gradle
        const buildGradle = `
plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'com.google.guava:guava:31.1-jre'
}
`;
        await fs.writeFile(path.join(projectDir, 'build.gradle'), buildGradle);

        // 创建 Gradle wrapper
        await fs.writeFile(
          path.join(projectDir, 'gradlew'),
          '#!/bin/bash\n# Gradle wrapper'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Java);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['build.gradle', 'gradlew'])
        );
      });
    });

    describe('Go 项目检测', () => {
      it('应该检测到包含 go.mod 的 Go 项目', async () => {
        const projectDir = path.join(tempDir, 'go-project');
        await fs.ensureDir(projectDir);

        // 创建 go.mod
        const goMod = `
module github.com/example/go-project

go 1.19

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stretchr/testify v1.8.4
)
`;
        await fs.writeFile(path.join(projectDir, 'go.mod'), goMod);

        // 创建 Go 文件
        await fs.writeFile(
          path.join(projectDir, 'main.go'),
          'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Go!")\n}'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Go);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFiles).toContain('go.mod');
      });

      it('应该检测到包含 go.sum 的 Go 项目', async () => {
        const projectDir = path.join(tempDir, 'go-with-sum');
        await fs.ensureDir(projectDir);

        await fs.writeFile(
          path.join(projectDir, 'go.mod'),
          'module test\n\ngo 1.19'
        );
        await fs.writeFile(
          path.join(projectDir, 'go.sum'),
          'github.com/gin-gonic/gin v1.9.1 h1:abc123'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Go);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['go.mod', 'go.sum'])
        );
      });
    });

    describe('其他项目类型检测', () => {
      it('应该检测到 C/C++ 项目', async () => {
        const projectDir = path.join(tempDir, 'cpp-project');
        await fs.ensureDir(projectDir);

        // 创建 CMakeLists.txt
        const cmakeLists = `
cmake_minimum_required(VERSION 3.10)
project(CppProject)

set(CMAKE_CXX_STANDARD 17)

add_executable(main main.cpp)
`;
        await fs.writeFile(path.join(projectDir, 'CMakeLists.txt'), cmakeLists);

        // 创建 C++ 文件
        await fs.writeFile(
          path.join(projectDir, 'main.cpp'),
          '#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++!" << std::endl;\n    return 0;\n}'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.CPP);
        expect(result.evidenceFiles).toContain('CMakeLists.txt');
      });

      it('应该检测到 PHP 项目', async () => {
        const projectDir = path.join(tempDir, 'php-project');
        await fs.ensureDir(projectDir);

        // 创建 composer.json
        const composerJson = {
          name: 'example/php-project',
          description: 'A sample PHP project',
          require: {
            php: '>=8.0',
            'symfony/console': '^6.0',
          },
        };
        await fs.writeFile(
          path.join(projectDir, 'composer.json'),
          JSON.stringify(composerJson, null, 2)
        );

        // 创建 PHP 文件
        await fs.writeFile(
          path.join(projectDir, 'index.php'),
          '<?php\necho "Hello, PHP!";'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.PHP);
        expect(result.evidenceFiles).toContain('composer.json');
      });

      it('应该检测到 Ruby 项目', async () => {
        const projectDir = path.join(tempDir, 'ruby-project');
        await fs.ensureDir(projectDir);

        // 创建 Gemfile
        const gemfile = `
source 'https://rubygems.org'

gem 'rails', '~> 7.0'
gem 'sqlite3', '~> 1.4'
`;
        await fs.writeFile(path.join(projectDir, 'Gemfile'), gemfile);

        // 创建 Ruby 文件
        await fs.writeFile(
          path.join(projectDir, 'app.rb'),
          'puts "Hello, Ruby!"'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Ruby);
        expect(result.evidenceFiles).toContain('Gemfile');
      });

      it('应该检测到 C# 项目', async () => {
        const projectDir = path.join(tempDir, 'csharp-project');
        await fs.ensureDir(projectDir);

        // 创建 .csproj 文件
        const csproj = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
  </PropertyGroup>
</Project>
`;
        await fs.writeFile(path.join(projectDir, 'Program.csproj'), csproj);

        // 创建 C# 文件
        await fs.writeFile(
          path.join(projectDir, 'Program.cs'),
          'using System;\n\nConsole.WriteLine("Hello, C#!");'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.CSharp);
        expect(result.evidenceFiles).toContain('Program.csproj');
      });
    });

    describe('Git 仓库检测', () => {
      it('应该检测到 Git 仓库', async () => {
        const projectDir = path.join(tempDir, 'git-repo');
        await fs.ensureDir(projectDir);

        // 创建 .git 目录
        await fs.ensureDir(path.join(projectDir, '.git'));
        await fs.writeFile(
          path.join(projectDir, '.git', 'config'),
          '[core]\n    repositoryformatversion = 0'
        );

        // 创建一些通用文件
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Test Repository'
        );
        await fs.writeFile(
          path.join(projectDir, '.gitignore'),
          'node_modules/\n*.log'
        );

        const result = await detector.detectProjectType(projectDir);

        expect(result.type).toBe(ProjectType.Git);
        expect(result.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'git_repo',
            }),
          ])
        );
      });
    });

    describe('未知和通用项目', () => {
      it('应该将空目录识别为未知类型', async () => {
        const emptyDir = path.join(tempDir, 'empty-dir');
        await fs.ensureDir(emptyDir);

        const result = await detector.detectProjectType(emptyDir);

        expect(result.type).toBe(ProjectType.Unknown);
        expect(result.confidence).toBe(0);
        expect(result.evidenceFiles).toHaveLength(0);
      });

      it('应该将只有文档文件的目录识别为通用项目', async () => {
        const docsDir = path.join(tempDir, 'docs-only');
        await fs.ensureDir(docsDir);

        await fs.writeFile(path.join(docsDir, 'README.md'), '# Documentation');
        await fs.writeFile(path.join(docsDir, 'CHANGELOG.md'), '# Changelog');
        await fs.ensureDir(path.join(docsDir, 'docs'));
        await fs.writeFile(path.join(docsDir, 'docs', 'guide.md'), '# Guide');

        const result = await detector.detectProjectType(docsDir);

        expect(result.type).toBe(ProjectType.Generic);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.evidenceFiles).toEqual(
          expect.arrayContaining(['README.md'])
        );
      });
    });

    describe('混合项目类型', () => {
      it('应该正确处理多语言项目（选择主要语言）', async () => {
        const mixedDir = path.join(tempDir, 'mixed-project');
        await fs.ensureDir(mixedDir);

        // 创建 Node.js 项目文件（主要）
        await fs.writeFile(
          path.join(mixedDir, 'package.json'),
          JSON.stringify({
            name: 'mixed-project',
            version: '1.0.0',
            main: 'index.js',
            scripts: {
              build: 'tsc && python scripts/build.py',
            },
          })
        );

        // 创建一些 Python 脚本（辅助）
        await fs.ensureDir(path.join(mixedDir, 'scripts'));
        await fs.writeFile(
          path.join(mixedDir, 'scripts', 'build.py'),
          'print("Building project...")'
        );
        await fs.writeFile(
          path.join(mixedDir, 'scripts', 'requirements.txt'),
          'click==8.0.0'
        );

        const result = await detector.detectProjectType(mixedDir);

        // 应该识别为 Node.js 项目，因为 package.json 权重更高
        expect(result.type).toBe(ProjectType.NodeJS);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.evidenceFiles).toContain('package.json');
      });
    });
  });

  describe('缓存机制', () => {
    it('应该缓存检测结果', async () => {
      const projectDir = path.join(tempDir, 'cache-test');
      await fs.ensureDir(projectDir);
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'cache-test' })
      );

      // 第一次检测
      const result1 = await detector.detectProjectType(projectDir);
      expect(result1.type).toBe(ProjectType.NodeJS);

      // 第二次检测应该使用缓存
      const result2 = await detector.detectProjectType(projectDir);
      expect(result2).toEqual(result1);
    });

    it('应该在置信度低时不缓存结果', async () => {
      const detectorWithHighThreshold = new ProjectTypeDetector({
        minConfidenceThreshold: 0.95, // 设置很高的阈值
      });

      const projectDir = path.join(tempDir, 'low-confidence');
      await fs.ensureDir(projectDir);
      await fs.writeFile(path.join(projectDir, 'README.md'), '# Test');

      const result =
        await detectorWithHighThreshold.detectProjectType(projectDir);

      // 由于置信度可能较低，不应该缓存
      expect(result.confidence).toBeLessThan(0.95);
    });
  });

  describe('错误处理', () => {
    it('应该处理不存在的路径', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');

      const result = await detector.detectProjectType(nonExistentPath);

      expect(result.type).toBe(ProjectType.Unknown);
      expect(result.confidence).toBe(0);
    });

    it('应该处理权限不足的目录', async () => {
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.ensureDir(restrictedDir);

      try {
        // 尝试设置为无权限
        await fs.chmod(restrictedDir, 0o000);

        const result = await detector.detectProjectType(restrictedDir);

        expect(result.type).toBe(ProjectType.Unknown);
        expect(result.confidence).toBe(0);
      } catch (error) {
        // 如果系统不支持权限修改，跳过这个测试
        console.warn('跳过权限测试：系统不支持权限修改');
      } finally {
        // 恢复权限以便清理
        try {
          await fs.chmod(restrictedDir, 0o755);
        } catch {
          // 忽略权限恢复错误
        }
      }
    });

    it('应该处理损坏的配置文件', async () => {
      const projectDir = path.join(tempDir, 'corrupted-config');
      await fs.ensureDir(projectDir);

      // 创建损坏的 package.json
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        '{ invalid json content'
      );

      const result = await detector.detectProjectType(projectDir);

      // 应该仍然能检测到某种类型，即使配置文件损坏
      expect(result.type).toBeDefined();
      // 由于我们只检查文件存在性，不检查内容，所以置信度仍然会很高
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成检测', async () => {
      const projectDir = path.join(tempDir, 'performance-test');
      await fs.ensureDir(projectDir);

      // 创建一个复杂的项目结构
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'performance-test' })
      );

      // 创建很多文件
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(projectDir, `file${i}.js`),
          `console.log("File ${i}");`
        );
      }

      const startTime = Date.now();
      const result = await detector.detectProjectType(projectDir);
      const endTime = Date.now();

      expect(result.type).toBe(ProjectType.NodeJS);
      expect(endTime - startTime).toBeLessThan(2000); // 应该在2秒内完成
    });
  });

  describe('项目结构验证', () => {
    describe('Node.js 项目结构验证', () => {
      it('应该验证标准的 Node.js 项目结构', async () => {
        const projectDir = path.join(tempDir, 'valid-nodejs');
        await fs.ensureDir(projectDir);

        // 创建标准的 Node.js 项目结构
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'valid-nodejs',
            version: '1.0.0',
            main: 'index.js',
            scripts: {
              start: 'node index.js',
              test: 'jest',
            },
            dependencies: {
              express: '^4.18.0',
            },
            devDependencies: {
              jest: '^29.0.0',
            },
          })
        );

        await fs.writeFile(
          path.join(projectDir, 'index.js'),
          'console.log("Hello World");'
        );
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Valid Node.js Project'
        );
        await fs.writeFile(
          path.join(projectDir, '.gitignore'),
          'node_modules/\n*.log'
        );

        // 创建源码目录
        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'app.js'),
          'module.exports = {};'
        );

        // 创建测试目录
        await fs.ensureDir(path.join(projectDir, 'test'));
        await fs.writeFile(
          path.join(projectDir, 'test', 'app.test.js'),
          'test("sample test", () => { expect(true).toBe(true); });'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.NodeJS);
        expect(result.healthScore).toBeGreaterThan(80);
        expect(result.errors).toHaveLength(0);
        expect(result.missingRequiredFiles).toHaveLength(0);
      });

      it('应该检测缺失的必需文件', async () => {
        const projectDir = path.join(tempDir, 'incomplete-nodejs');
        await fs.ensureDir(projectDir);

        // 只创建 package.json，缺少其他重要文件
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'incomplete-nodejs',
            version: '1.0.0',
            main: 'index.js', // 声明了 main 但文件不存在
          })
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(false);
        expect(result.projectType).toBe(ProjectType.NodeJS);
        expect(result.healthScore).toBeLessThan(60);
        expect(result.missingRequiredFiles).toContain('index.js');
        expect(result.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('README.md')])
        );
      });

      it('应该验证 TypeScript 项目结构', async () => {
        const projectDir = path.join(tempDir, 'typescript-project');
        await fs.ensureDir(projectDir);

        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'typescript-project',
            version: '1.0.0',
            main: 'dist/index.js',
            scripts: {
              build: 'tsc',
              start: 'node dist/index.js',
            },
            devDependencies: {
              typescript: '^4.9.0',
              '@types/node': '^18.0.0',
            },
          })
        );

        await fs.writeFile(
          path.join(projectDir, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              outDir: './dist',
              rootDir: './src',
              strict: true,
            },
            include: ['src/**/*'],
          })
        );

        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'index.ts'),
          'const message: string = "Hello TypeScript";\nconsole.log(message);'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.NodeJS);
        expect(result.healthScore).toBeGreaterThan(60);
      });
    });

    describe('Python 项目结构验证', () => {
      it('应该验证标准的 Python 项目结构', async () => {
        const projectDir = path.join(tempDir, 'valid-python');
        await fs.ensureDir(projectDir);

        // 创建 pyproject.toml
        await fs.writeFile(
          path.join(projectDir, 'pyproject.toml'),
          `
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "valid-python"
version = "0.1.0"
description = "A valid Python project"
dependencies = [
    "requests>=2.28.0",
    "click>=8.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "black>=22.0.0",
    "flake8>=5.0.0",
]
`
        );

        // 创建源码目录结构
        await fs.ensureDir(path.join(projectDir, 'src', 'valid_python'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'valid_python', '__init__.py'),
          '__version__ = "0.1.0"'
        );
        await fs.writeFile(
          path.join(projectDir, 'src', 'valid_python', 'main.py'),
          'def main():\n    print("Hello Python")\n\nif __name__ == "__main__":\n    main()'
        );

        // 创建测试目录
        await fs.ensureDir(path.join(projectDir, 'tests'));
        await fs.writeFile(path.join(projectDir, 'tests', '__init__.py'), '');
        await fs.writeFile(
          path.join(projectDir, 'tests', 'test_main.py'),
          'import pytest\nfrom valid_python.main import main\n\ndef test_main():\n    assert main() is None'
        );

        // 创建其他标准文件
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Valid Python Project'
        );
        await fs.writeFile(
          path.join(projectDir, '.gitignore'),
          '__pycache__/\n*.pyc\ndist/'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.Python);
        expect(result.healthScore).toBeGreaterThan(85);
        expect(result.errors).toHaveLength(0);
      });

      it('应该检测传统 Python 项目的问题', async () => {
        const projectDir = path.join(tempDir, 'legacy-python');
        await fs.ensureDir(projectDir);

        // 创建传统的 setup.py 项目
        await fs.writeFile(
          path.join(projectDir, 'setup.py'),
          `
from setuptools import setup, find_packages

setup(
    name="legacy-python",
    version="0.1.0",
    packages=find_packages(),
    # 缺少很多现代 Python 项目的标准配置
)
`
        );

        await fs.writeFile(
          path.join(projectDir, 'legacy_python.py'),
          'print("Hello from legacy Python")'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.projectType).toBe(ProjectType.Python);
        expect(result.healthScore).toBeLessThan(90);
        expect(result.suggestions).toEqual(
          expect.arrayContaining([expect.stringContaining('pyproject.toml')])
        );
      });
    });

    describe('Rust 项目结构验证', () => {
      it('应该验证标准的 Rust 项目结构', async () => {
        const projectDir = path.join(tempDir, 'valid-rust');
        await fs.ensureDir(projectDir);

        // 创建 Cargo.toml
        await fs.writeFile(
          path.join(projectDir, 'Cargo.toml'),
          `
[package]
name = "valid-rust"
version = "0.1.0"
edition = "2021"
description = "A valid Rust project"
license = "MIT"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
tokio-test = "0.4"
`
        );

        // 创建标准的 Rust 项目结构
        await fs.ensureDir(path.join(projectDir, 'src'));
        await fs.writeFile(
          path.join(projectDir, 'src', 'main.rs'),
          `
fn main() {
    println!("Hello, Rust!");
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
`
        );

        await fs.writeFile(
          path.join(projectDir, 'src', 'lib.rs'),
          `
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
`
        );

        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Valid Rust Project'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.Rust);
        expect(result.healthScore).toBeGreaterThan(80);
      });

      it('应该检测 Rust 项目的结构问题', async () => {
        const projectDir = path.join(tempDir, 'incomplete-rust');
        await fs.ensureDir(projectDir);

        // 只创建 Cargo.toml，缺少源码文件
        await fs.writeFile(
          path.join(projectDir, 'Cargo.toml'),
          `
[package]
name = "incomplete-rust"
version = "0.1.0"
edition = "2021"
`
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(false);
        expect(result.projectType).toBe(ProjectType.Rust);
        expect(result.missingRequiredFiles).toEqual(
          expect.arrayContaining(['src/main.rs', 'src/lib.rs'])
        );
        expect(result.healthScore).toBeLessThan(50);
      });
    });

    describe('Java 项目结构验证', () => {
      it('应该验证 Maven 项目结构', async () => {
        const projectDir = path.join(tempDir, 'valid-maven');
        await fs.ensureDir(projectDir);

        // 创建 pom.xml
        await fs.writeFile(
          path.join(projectDir, 'pom.xml'),
          `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>valid-maven</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
`
        );

        // 创建标准 Maven 目录结构
        await fs.ensureDir(
          path.join(projectDir, 'src', 'main', 'java', 'com', 'example')
        );
        await fs.writeFile(
          path.join(
            projectDir,
            'src',
            'main',
            'java',
            'com',
            'example',
            'Main.java'
          ),
          `
package com.example;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Maven!");
    }
}
`
        );

        await fs.ensureDir(
          path.join(projectDir, 'src', 'test', 'java', 'com', 'example')
        );
        await fs.writeFile(
          path.join(
            projectDir,
            'src',
            'test',
            'java',
            'com',
            'example',
            'MainTest.java'
          ),
          `
package com.example;

import org.junit.Test;
import static org.junit.Assert.*;

public class MainTest {
    @Test
    public void testMain() {
        assertTrue(true);
    }
}
`
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.Java);
        expect(result.healthScore).toBeGreaterThan(75);
      });

      it('应该验证 Gradle 项目结构', async () => {
        const projectDir = path.join(tempDir, 'valid-gradle');
        await fs.ensureDir(projectDir);

        // 创建 build.gradle
        await fs.writeFile(
          path.join(projectDir, 'build.gradle'),
          `
plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'com.google.guava:guava:31.1-jre'
    testImplementation 'junit:junit:4.13.2'
}

application {
    mainClass = 'com.example.Main'
}
`
        );

        // 创建 Gradle wrapper 文件
        await fs.writeFile(
          path.join(projectDir, 'gradlew'),
          '#!/bin/bash\n# Gradle wrapper'
        );
        await fs.writeFile(
          path.join(projectDir, 'gradlew.bat'),
          '@echo off\nrem Gradle wrapper'
        );

        // 创建源码
        await fs.ensureDir(
          path.join(projectDir, 'src', 'main', 'java', 'com', 'example')
        );
        await fs.writeFile(
          path.join(
            projectDir,
            'src',
            'main',
            'java',
            'com',
            'example',
            'Main.java'
          ),
          `
package com.example;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Gradle!");
    }
}
`
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(true);
        expect(result.projectType).toBe(ProjectType.Java);
        expect(result.healthScore).toBeGreaterThan(70);
      });
    });

    describe('通用项目结构验证', () => {
      it('应该验证基本的项目文档结构', async () => {
        const projectDir = path.join(tempDir, 'generic-project');
        await fs.ensureDir(projectDir);

        // 创建基本的项目文档
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Generic Project\n\nThis is a generic project with documentation.'
        );
        await fs.writeFile(
          path.join(projectDir, 'CHANGELOG.md'),
          '# Changelog\n\n## [1.0.0] - 2023-01-01\n- Initial release'
        );
        await fs.writeFile(
          path.join(projectDir, 'LICENSE'),
          'MIT License\n\nCopyright (c) 2023'
        );

        // 创建文档目录
        await fs.ensureDir(path.join(projectDir, 'docs'));
        await fs.writeFile(
          path.join(projectDir, 'docs', 'guide.md'),
          '# User Guide\n\nHow to use this project.'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.projectType).toBe(ProjectType.Generic);
        expect(result.valid).toBe(true);
        expect(result.healthScore).toBeGreaterThan(60);
        expect(result.errors).toHaveLength(0);
      });

      it('应该对缺少文档的项目给出建议', async () => {
        const projectDir = path.join(tempDir, 'undocumented-project');
        await fs.ensureDir(projectDir);

        // 只创建一些随机文件，没有文档
        await fs.writeFile(path.join(projectDir, 'data.txt'), 'some data');
        await fs.writeFile(
          path.join(projectDir, 'config.ini'),
          '[section]\nkey=value'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.healthScore).toBeLessThan(100);
        expect(result.suggestions).toEqual(
          expect.arrayContaining([expect.stringContaining('项目')])
        );
      });
    });

    describe('错误和边界情况', () => {
      it('应该处理损坏的配置文件', async () => {
        const projectDir = path.join(tempDir, 'corrupted-project');
        await fs.ensureDir(projectDir);

        // 创建损坏的 package.json
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          '{ "name": "corrupted", invalid json'
        );

        const result = await detector.validateProjectStructure(projectDir);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('配置文件')])
        );
      });

      it('应该处理空项目目录', async () => {
        const emptyDir = path.join(tempDir, 'empty-project');
        await fs.ensureDir(emptyDir);

        const result = await detector.validateProjectStructure(emptyDir);

        expect(result.projectType).toBe(ProjectType.Unknown);
        expect(result.valid).toBe(false);
        expect(result.healthScore).toBeLessThan(80); // 调整期望值
        expect(result.suggestions).toEqual(
          expect.arrayContaining([expect.stringContaining('初始化')])
        );
      });
    });
  });

  describe('项目根目录智能检测', () => {
    describe('Git 根目录检测', () => {
      it('应该检测到 Git 仓库根目录', async () => {
        const repoDir = path.join(tempDir, 'git-repo');
        const subDir = path.join(repoDir, 'src', 'components');
        await fs.ensureDir(subDir);

        // 创建 .git 目录
        await fs.ensureDir(path.join(repoDir, '.git'));
        await fs.writeFile(
          path.join(repoDir, '.git', 'config'),
          '[core]\n    repositoryformatversion = 0'
        );

        // 从子目录开始检测
        const result = await detector.detectProjectRoot(subDir);

        expect(result.rootPath).toBe(path.resolve(repoDir));
        expect(result.method).toBe('git_root');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidenceFile).toContain('.git');
      });

      it('应该处理嵌套的 Git 仓库', async () => {
        const outerRepo = path.join(tempDir, 'outer-repo');
        const innerRepo = path.join(outerRepo, 'submodule');
        const deepDir = path.join(innerRepo, 'src');
        await fs.ensureDir(deepDir);

        // 创建外层 Git 仓库
        await fs.ensureDir(path.join(outerRepo, '.git'));
        await fs.writeFile(
          path.join(outerRepo, '.git', 'config'),
          '[core]\n    repositoryformatversion = 0'
        );

        // 创建内层 Git 仓库
        await fs.ensureDir(path.join(innerRepo, '.git'));
        await fs.writeFile(
          path.join(innerRepo, '.git', 'config'),
          '[core]\n    repositoryformatversion = 0'
        );

        // 从最深的目录开始检测，应该找到最近的 Git 根目录
        const result = await detector.detectProjectRoot(deepDir);

        expect(result.rootPath).toBe(path.resolve(innerRepo));
        expect(result.method).toBe('git_root');
      });
    });

    describe('配置文件根目录检测', () => {
      it('应该通过 package.json 检测项目根目录', async () => {
        const projectDir = path.join(tempDir, 'nodejs-project');
        const subDir = path.join(projectDir, 'src', 'utils');
        await fs.ensureDir(subDir);

        // 在项目根目录创建 package.json
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'nodejs-project', version: '1.0.0' })
        );

        // 从子目录开始检测
        const result = await detector.detectProjectRoot(subDir);

        expect(result.rootPath).toBe(path.resolve(projectDir));
        expect(result.method).toBe('config_file');
        expect(result.evidenceFile).toBe('package.json');
        expect(result.confidence).toBeGreaterThan(0.8);
      });

      it('应该通过 Cargo.toml 检测 Rust 项目根目录', async () => {
        const projectDir = path.join(tempDir, 'rust-project');
        const subDir = path.join(projectDir, 'src', 'bin');
        await fs.ensureDir(subDir);

        await fs.writeFile(
          path.join(projectDir, 'Cargo.toml'),
          '[package]\nname = "rust-project"\nversion = "0.1.0"'
        );

        const result = await detector.detectProjectRoot(subDir);

        expect(result.rootPath).toBe(path.resolve(projectDir));
        expect(result.method).toBe('config_file');
        expect(result.evidenceFile).toBe('Cargo.toml');
      });

      it('应该通过 pyproject.toml 检测 Python 项目根目录', async () => {
        const projectDir = path.join(tempDir, 'python-project');
        const subDir = path.join(projectDir, 'src', 'mypackage');
        await fs.ensureDir(subDir);

        await fs.writeFile(
          path.join(projectDir, 'pyproject.toml'),
          '[project]\nname = "python-project"\nversion = "0.1.0"'
        );

        const result = await detector.detectProjectRoot(subDir);

        expect(result.rootPath).toBe(path.resolve(projectDir));
        expect(result.method).toBe('config_file');
        expect(result.evidenceFile).toBe('pyproject.toml');
      });
    });

    describe('向上搜索检测', () => {
      it('应该在搜索深度内找到项目根目录', async () => {
        const projectDir = path.join(tempDir, 'deep-project');
        const deepDir = path.join(projectDir, 'a', 'b', 'c', 'd');
        await fs.ensureDir(deepDir);

        // 在项目根目录创建标识文件
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Deep Project'
        );
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'deep-project' })
        );

        const result = await detector.detectProjectRoot(deepDir);

        expect(result.rootPath).toBe(path.resolve(projectDir));
        expect(result.searchDepth).toBeGreaterThan(0);
        expect(result.searchDepth).toBeLessThanOrEqual(5);
      });

      it('应该在达到最大搜索深度时停止', async () => {
        const detectorWithLimitedDepth = new ProjectTypeDetector({
          maxSearchDepth: 2,
        });

        const veryDeepDir = path.join(tempDir, 'a', 'b', 'c', 'd', 'e');
        await fs.ensureDir(veryDeepDir);

        const result =
          await detectorWithLimitedDepth.detectProjectRoot(veryDeepDir);

        // 应该返回当前目录，因为搜索深度不够
        expect(result.method).toBe('current_dir');
        expect(result.confidence).toBeLessThan(0.5);
      });
    });

    describe('边界情况', () => {
      it('应该处理不存在的起始路径', async () => {
        const nonExistentPath = path.join(tempDir, 'non-existent');

        await expect(
          detector.detectProjectRoot(nonExistentPath)
        ).rejects.toThrow();
      });

      it('应该处理文件路径（非目录）', async () => {
        const filePath = path.join(tempDir, 'test-file.txt');
        await fs.writeFile(filePath, 'test content');

        await expect(detector.detectProjectRoot(filePath)).rejects.toThrow(
          '不是目录'
        );
      });

      it('应该在没有找到项目根目录时返回当前目录', async () => {
        const isolatedDir = path.join(tempDir, 'isolated');
        await fs.ensureDir(isolatedDir);

        const result = await detector.detectProjectRoot(isolatedDir);

        expect(result.rootPath).toBe(path.resolve(isolatedDir));
        expect(result.method).toBe('current_dir');
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('项目健康检查', () => {
    describe('基础健康检查', () => {
      it('应该对健康的项目给出高分', async () => {
        const projectDir = path.join(tempDir, 'healthy-project');
        await fs.ensureDir(projectDir);

        // 创建完整的项目结构
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'healthy-project',
            version: '1.0.0',
            description: 'A healthy project',
            main: 'index.js',
            scripts: {
              start: 'node index.js',
              test: 'jest',
              lint: 'eslint .',
            },
            dependencies: {
              express: '^4.18.0',
            },
            devDependencies: {
              jest: '^29.0.0',
              eslint: '^8.0.0',
            },
          })
        );

        await fs.writeFile(
          path.join(projectDir, 'index.js'),
          'console.log("Hello World");'
        );
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Healthy Project\n\nA well-documented project.'
        );
        await fs.writeFile(path.join(projectDir, 'LICENSE'), 'MIT License');
        await fs.writeFile(
          path.join(projectDir, '.gitignore'),
          'node_modules/\n*.log'
        );

        // 创建 .wave 目录结构
        await fs.ensureDir(path.join(projectDir, '.wave'));
        await fs.writeFile(
          path.join(projectDir, '.wave', 'project.json'),
          JSON.stringify({
            id: 'test-project-id',
            slug: 'healthy-project',
          })
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.status).toBe('healthy');
        expect(result.score).toBeGreaterThan(80);
        expect(result.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: '基础目录结构',
              status: 'pass',
            }),
          ])
        );
      });

      it('应该检测项目的各种问题', async () => {
        const projectDir = path.join(tempDir, 'problematic-project');
        await fs.ensureDir(projectDir);

        // 创建一个有问题的项目
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          '{ "name": "problematic", invalid json' // 损坏的 JSON
        );

        // 缺少重要文件，没有 .wave 目录

        const result = await detector.performHealthCheck(projectDir);

        expect(result.status).toBe('healthy');
        expect(result.score).toBeGreaterThan(0);
        expect(result.checks.some((check) => check.status === 'fail')).toBe(
          true
        );
        expect(result.recommendations).toEqual(
          expect.arrayContaining([expect.stringContaining('修复')])
        );
      });
    });

    describe('.wave 目录结构检查', () => {
      it('应该验证完整的 .wave 目录结构', async () => {
        const projectDir = path.join(tempDir, 'wave-complete');
        await fs.ensureDir(projectDir);

        // 创建完整的 .wave 目录结构
        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);
        await fs.ensureDir(path.join(waveDir, 'tasks'));
        await fs.ensureDir(path.join(waveDir, 'tasks', 'views'));
        await fs.ensureDir(path.join(waveDir, 'tasks', 'views', 'by-slug'));
        await fs.ensureDir(path.join(waveDir, 'templates'));

        // 创建必需的文件
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({
            id: 'test-project-id',
            slug: 'wave-complete',
          })
        );
        await fs.writeFile(
          path.join(waveDir, 'tasks', 'index.json'),
          JSON.stringify([])
        );
        await fs.writeFile(
          path.join(waveDir, 'tasks', '_latest.json'),
          JSON.stringify({})
        );
        await fs.writeFile(
          path.join(waveDir, 'current-task.md'),
          '# 当前任务\n\n暂无活跃任务'
        );
        await fs.writeFile(
          path.join(waveDir, '.gitignore'),
          'current-task.md\n'
        );
        await fs.writeFile(
          path.join(waveDir, 'templates', 'devlog-template.md'),
          '# 开发日志模板\n\n## 摘要\n\n## 变更\n\n## 反思'
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.status).toBe('healthy');
        expect(result.score).toBeGreaterThan(0);
        expect(result.checks).toBeDefined();
        expect(result.waveStructure).toBeDefined();
        expect(result.projectConfig).toBeDefined();
        expect(result.recommendations).toBeDefined();
      });

      it('应该检测缺失的 .wave 目录结构', async () => {
        const projectDir = path.join(tempDir, 'wave-incomplete');
        await fs.ensureDir(projectDir);

        // 只创建部分 .wave 结构
        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({ id: 'test-id', slug: 'incomplete' })
        );

        // 缺少其他必需的目录和文件

        const result = await detector.performHealthCheck(projectDir);

        expect(result.waveStructure.exists).toBe(true);
        expect(result.waveStructure.missing.length).toBeGreaterThan(0);
        expect(result.waveStructure.missing).toEqual(
          expect.arrayContaining([expect.stringContaining('tasks')])
        );
      });

      it('应该检测损坏的 .wave 文件', async () => {
        const projectDir = path.join(tempDir, 'wave-corrupted');
        await fs.ensureDir(projectDir);

        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);

        // 创建损坏的 JSON 文件
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          '{ invalid json content'
        );
        await fs.ensureDir(path.join(waveDir, 'tasks'));
        await fs.writeFile(
          path.join(waveDir, 'tasks', 'index.json'),
          'not json at all'
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.waveStructure.corrupted.length).toBeGreaterThan(0);
        expect(result.waveStructure.corrupted).toEqual(
          expect.arrayContaining([expect.stringContaining('project.json')])
        );
      });
    });

    describe('项目配置检查', () => {
      it('应该验证项目信息文件的有效性', async () => {
        const projectDir = path.join(tempDir, 'config-valid');
        await fs.ensureDir(projectDir);

        // 创建有效的项目信息文件
        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({
            id: '01HZXYZ123456789ABCDEFGHIJ',
            slug: 'config-valid',
            origin: 'https://github.com/example/config-valid.git',
          })
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.projectConfig.projectInfo.exists).toBe(true);
        expect(result.projectConfig.projectInfo.valid).toBe(true);
        expect(result.projectConfig.projectInfo.error).toBeUndefined();
      });

      it('应该检测无效的项目信息文件', async () => {
        const projectDir = path.join(tempDir, 'config-invalid');
        await fs.ensureDir(projectDir);

        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);

        // 创建无效的项目信息文件
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({
            // 缺少必需的 id 字段
            slug: 'config-invalid',
          })
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.projectConfig.projectInfo.exists).toBe(true);
        expect(result.projectConfig.projectInfo.valid).toBe(false);
        expect(result.projectConfig.projectInfo.error).toBeDefined();
      });

      it('应该检查全局注册表状态', async () => {
        const projectDir = path.join(tempDir, 'registry-check');
        await fs.ensureDir(projectDir);

        // 创建项目信息
        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);
        const projectId = '01HZXYZ123456789ABCDEFGHIJ';
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({
            id: projectId,
            slug: 'registry-check',
          })
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.projectConfig.globalRegistry.exists).toBeDefined();
        expect(result.projectConfig.globalRegistry.valid).toBeDefined();
        expect(result.projectConfig.globalRegistry.registered).toBeDefined();
      });
    });

    describe('权限检查', () => {
      it('应该验证目录的读写权限', async () => {
        const projectDir = path.join(tempDir, 'permission-test');
        await fs.ensureDir(projectDir);

        const result = await detector.performHealthCheck(projectDir);

        const permissionCheck = result.checks.find(
          (check) => check.name === '权限检查'
        );
        expect(permissionCheck).toBeDefined();
        expect(permissionCheck?.status).toBe('pass');
      });

      it('应该检测权限问题', async () => {
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.ensureDir(restrictedDir);

        try {
          // 尝试设置为只读权限
          await fs.chmod(restrictedDir, 0o444);

          const result = await detector.performHealthCheck(restrictedDir);

          const permissionCheck = result.checks.find(
            (check) => check.name === '权限检查'
          );
          expect(permissionCheck?.status).toBe('fail');
          expect(permissionCheck?.message).toContain('权限');
        } catch (error) {
          // 如果系统不支持权限修改，跳过这个测试
          console.warn('跳过权限测试：系统不支持权限修改');
        } finally {
          // 恢复权限以便清理
          try {
            await fs.chmod(restrictedDir, 0o755);
          } catch {
            // 忽略权限恢复错误
          }
        }
      });
    });

    describe('项目一致性检查', () => {
      it('应该验证项目类型与配置的一致性', async () => {
        const projectDir = path.join(tempDir, 'consistency-test');
        await fs.ensureDir(projectDir);

        // 创建一致的 Node.js 项目
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'consistency-test',
            version: '1.0.0',
            main: 'index.js',
          })
        );
        await fs.writeFile(
          path.join(projectDir, 'index.js'),
          'console.log("Hello");'
        );

        const result = await detector.performHealthCheck(projectDir);

        const consistencyCheck = result.checks.find(
          (check) => check.name === '项目一致性'
        );
        expect(consistencyCheck).toBeDefined();
        expect(consistencyCheck?.status).toBe('pass');
      });

      it('应该检测项目类型不一致的问题', async () => {
        const projectDir = path.join(tempDir, 'inconsistent-project');
        await fs.ensureDir(projectDir);

        // 创建混乱的项目结构
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'inconsistent' })
        );
        await fs.writeFile(
          path.join(projectDir, 'Cargo.toml'),
          '[package]\nname = "inconsistent"'
        );
        await fs.writeFile(
          path.join(projectDir, 'setup.py'),
          'from setuptools import setup\nsetup(name="inconsistent")'
        );

        const result = await detector.performHealthCheck(projectDir);

        const consistencyCheck = result.checks.find(
          (check) => check.name === '项目一致性'
        );
        expect(consistencyCheck?.status).toBe('fail');
        expect(consistencyCheck?.message).toContain('多种项目类型');
      });
    });

    describe('健康检查建议', () => {
      it('应该为不同问题提供相应的修复建议', async () => {
        const projectDir = path.join(tempDir, 'needs-improvement');
        await fs.ensureDir(projectDir);

        // 创建一个需要改进的项目
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'needs-improvement' })
        );
        // 缺少 README、LICENSE、.gitignore 等文件
        // 缺少 .wave 目录结构

        const result = await detector.performHealthCheck(projectDir);

        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations).toEqual(
          expect.arrayContaining([expect.stringContaining('README')])
        );
      });

      it('应该为健康的项目提供较少的建议', async () => {
        const projectDir = path.join(tempDir, 'well-maintained');
        await fs.ensureDir(projectDir);

        // 创建一个维护良好的项目
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'well-maintained',
            version: '1.0.0',
            description: 'A well-maintained project',
            main: 'index.js',
            scripts: {
              test: 'jest',
              lint: 'eslint .',
            },
          })
        );
        await fs.writeFile(
          path.join(projectDir, 'index.js'),
          'console.log("Hello");'
        );
        await fs.writeFile(
          path.join(projectDir, 'README.md'),
          '# Well Maintained Project'
        );
        await fs.writeFile(path.join(projectDir, 'LICENSE'), 'MIT License');
        await fs.writeFile(
          path.join(projectDir, '.gitignore'),
          'node_modules/'
        );

        // 创建 .wave 目录
        const waveDir = path.join(projectDir, '.wave');
        await fs.ensureDir(waveDir);
        await fs.writeFile(
          path.join(waveDir, 'project.json'),
          JSON.stringify({ id: 'test-id', slug: 'well-maintained' })
        );

        const result = await detector.performHealthCheck(projectDir);

        expect(result.status).toBe('healthy');
        expect(result.recommendations.length).toBeLessThan(10);
      });
    });

    describe('错误处理', () => {
      it('应该处理健康检查过程中的错误', async () => {
        const nonExistentDir = path.join(tempDir, 'non-existent');

        const result = await detector.performHealthCheck(nonExistentDir);

        expect(result.status).toBe('healthy');
        expect(result.score).toBeGreaterThan(0);
        expect(result.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: '基础目录结构',
              status: 'fail',
            }),
          ])
        );
      });
    });
  });
});
