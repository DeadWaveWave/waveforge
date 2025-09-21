> 文件命名格式模板: development-guidelines.md
> 文件路径: docs/development/

# [项目名称] - 开发指南

**版本**: 1.0
**最后更新**: [YYYY-MM-DD]
**作者**: [作者/团队名称]
**状态**: [例如：草稿, 生效, 废弃]

## 1. 引言 (Introduction)

### 1.1 文档目的
本文档定义了 [项目名称] 应用/系统开发所遵循的核心架构原则、设计模式和开发规范。旨在确保代码的一致性、可维护性、可测试性和可扩展性，为所有团队成员（包括 AI 协作者）提供统一的开发标准，降低沟通成本，提高开发效率和产品质量。

### 1.2 [可选] 项目概览/技术栈概览
[简要介绍项目目标 (可参考 Version PRD)、核心功能和主要使用的技术栈，为后续规范提供上下文。例如：本项目是一个使用 React 前端和 FastAPI 后端的 AI 伴学工具原型...]

## 2. 通用指南 (Common Guidelines)
[本部分包含适用于项目所有部分或跨前后端的原则和规范]

### 2.1 核心架构原则 (High-Level Architecture Principles)
[定义项目整体架构遵循的基本原则]
*   **架构目标**: [结合项目阶段 (e.g., MVP, 成熟期) 和 Version PRD 目标，明确并排序架构目标。如何平衡快速迭代与长期维护？]
    *   **简洁性与可读性 (Simplicity & Readability)**: [例如：代码应易于理解，优先选择简单直接的实现]
    *   **一致性 (Consistency)**: [例如：遵循本文档定义的规范，使用代码风格工具确保统一]
    *   **可测试性 (Testability)**: [例如：架构设计应支持单元、集成和端到端测试，如何解耦？]
    *   **可维护性 (Maintainability)**: [例如：清晰的模块划分、职责分离、文档化，如何降低修改成本？]
    *   **可扩展性 (Scalability/Extensibility)**: [例如：模块化设计、接口预留、适应未来需求变化，如何应对用户增长或功能增加？]
    *   **(可选) 其他目标**: [例如：性能、安全性、可靠性、快速迭代]
*   **高层架构图 (示例：前后端分离)**: [绘制简明架构图，展示核心组件及其主要交互。推荐使用 Mermaid。]
```mermaid
    graph LR
        subgraph Browser/Client
            A[用户界面 (UI Components)]
            B[前端逻辑/状态 (e.g., Hooks, Services, State Mgmt)]
        end
        subgraph Server
            C[后端 API (e.g., REST, GraphQL)]
            D[业务逻辑/服务层]
            E[数据访问层 (DAL)]
            F[数据库/外部服务]
        end
        A -- 用户操作 --> B
        B -- API 请求 --> C
        C -- 调用 --> D
        D -- 调用 --> E
        E -- 访问 --> F
        F -- 数据 --> E
        E -- 数据 --> D
        D -- 结果 --> C
        C -- API 响应 --> B
        B -- 更新状态 --> A
    ```
*   **[可选] 关键架构决策**: [记录项目中重要的架构选型及其理由，例如：为何选择前后端分离？为何选择特定框架？]

### 2.2 文档生态系统 (Documentation Ecosystem)
*   **目的**: 为了清晰、高效地指导开发和维护工作，我们采用多种文档类型，各司其职：
    *   **产品需求文档 (PRD - Version & Story)**: 定义"为什么做"（背景、目标）和"做什么"（用户故事、需求范围、验收标准）。位于 `docs/product/prd/`。
    *   **开发指南 (Development Guidelines - 本文档)**: 定义"如何做"（技术标准、架构原则、编码规范、工作流程）。
    *   **功能特性文档 (Feature Docs)**: 描述系统"有什么功能"以及"关键实现在哪里"（功能模块划分、代码入口、暴露接口）。位于 `docs/product/features/`。
    *   **开发日志 (Devlogs)**: 记录"开发过程"（任务执行步骤、遇到的问题、决策记录）。位于 `docs/product/prd/[prd-version]/devlogs/` 和 `.cursor/devlogs/`。
*   **关系**: 这些文档相互补充，共同构成了项目的知识库。开发过程中应根据需要查阅、参考和维护相关文档。

### 2.3 版本控制与 Git 工作流 (Version Control & Git Workflow)
[定义团队协作的版本控制流程]
*   **分支策略**: [明确分支模型，例如：GitFlow (main, develop, feature/*, release/*, hotfix/*), GitHub Flow (main, feature/*), 或项目特定的简化流程。哪个分支是稳定的？新功能/修复在哪开发？]
*   **Commit Message 规范**: [例如：强制遵循 Conventional Commits 规范 (`<type>(<scope>): <subject>`) 以便于生成 Change Log 和理解提交历史]。
*   **Code Review 要求**: [合并到关键分支 (e.g., main, develop) 前是否需要 Code Review？需要多少人 Review？Review 的重点是什么？由谁负责 Review？]
*   **提交前检查**: [开发者本地提交前需要执行哪些检查？(e.g., Linting, Formatting, Tests)]

### 2.4 API 交互与契约 (API Interaction & Contract)
[定义前后端或其他服务间 API 的设计和维护规范]
*   **API 设计风格**: [例如：RESTful API (遵循标准 HTTP 方法和状态码), GraphQL]。
*   **API 文档规范**:
    *   如何定义和维护 API 文档？ [例如：强制使用 OpenAPI (Swagger) 并通过后端框架自动生成 `openapi.json`, 使用 Postman Collection, 或维护 GraphQL Schema]。
    *   文档应包含哪些信息？ [路径、方法、参数、请求/响应体示例、错误码等]。
*   **前后端类型同步机制**: [如何确保前后端数据结构一致？]
    *   **强烈推荐**: 使用代码生成工具 ([例如：openapi-typescript-codegen, GraphQL Code Generator]) 基于 API 规范自动生成前端类型定义。
    *   **禁止**: 手动编写/同步 API 类型定义。
    *   项目中应包含相应的生成脚本 ([例如：`npm run gen:types`]) 并集成到开发流程中。
*   **API 版本控制**: [如何管理 API 版本？例如：URL路径版本 (/v1/, /v2/), Header 版本控制, 或暂不进行显式版本控制？]

### 2.5 通用编码规范 (General Coding Standards)
[适用于项目中所有代码的基础编码规则]
*   **基础语言规范**: [链接到使用的主要语言的官方风格指南或社区广泛接受的标准，例如： PEP 8 (Python), Airbnb JavaScript Style Guide, Google Java Style Guide]。
*   **命名约定**: [定义通用的命名约定，覆盖 文件、目录、常量 等。具体语言/框架的命名规范可在对应章节细化]。
*   **注释规范**:
    *   **原则**: [何时需要写注释？(e.g., 解释复杂逻辑、算法、workaround、重要决策原因)。避免什么样的注释？(e.g., 复述代码)]。
    *   **TODO/FIXME**: [定义标准格式和处理流程 (`// TODO: [描述] (@负责人 可选)`)]。
*   **代码风格与格式化工具**: [确保一致性的关键]
    *   **强制使用**: [明确项目使用的代码格式化工具 (例如：Prettier, Black, gofmt) 和代码检查工具 (例如：ESLint, Ruff, Checkstyle, RuboCop)]。
    *   **配置文件**: [配置文件 (e.g., `.prettierrc`, `pyproject.toml`, `.eslintrc.json`) 应纳入版本控制]。
    *   **CI 集成**: [是否在 CI 中强制检查代码风格？]。

### 2.6 错误处理原则 (Error Handling Principles)
[定义错误处理的通用策略]
*   **错误分类与定义**: [如何区分不同类型的错误？(e.g., 用户输入错误、业务逻辑错误、第三方服务错误、系统内部错误)。是否有统一的错误码或错误对象结构？]。
*   **错误传递**: [错误如何在不同层级/服务间传递？(e.g., 抛出特定异常, 返回包含错误信息的 Result 对象)]。
*   **日志记录基本要求**: [所有未捕获或关键错误都应记录日志。日志应包含哪些信息才能方便排查？(Trace ID, 时间戳, 错误详情, 上下文)]。
*   **敏感信息处理**: [强调不在错误信息和日志中暴露敏感数据]。

### 2.7 测试策略原则 (Testing Strategy Principles)
[定义测试的基本方法和目标]
*   **测试理念**: [例如：遵循测试金字塔 (或测试菱形/蜂巢)，明确各类型测试的投入比例和侧重点。TDD/BDD 是否适用？]。
*   **测试类型定义**: [明确项目中单元、集成、端到端测试的具体含义和边界]。
    *   **单元测试 (Unit)**: [测试目标？(e.g., 单个函数、类、模块的逻辑)。是否需要 Mock 依赖？]。
    *   **集成测试 (Integration)**: [测试目标？(e.g., 模块间交互、与外部服务(Mocked)交互、API 端点)]。
    *   **端到端测试 (E2E)**: [测试目标？(e.g., 模拟真实用户场景、覆盖关键业务流程)。手动还是自动化？]。
*   **测试覆盖率**: [是否设定目标？如何衡量？强调理性看待覆盖率数字]。

### 2.8 依赖管理 (Dependency Management)
[如何管理项目的外部依赖]
*   **包管理器**: [明确项目各部分使用的包管理器，例如：pnpm/yarn/npm (前端), uv/Poetry/pip (后端)]。
*   **依赖文件**: [明确哪些依赖文件需要纳入版本控制 (e.g., `package.json`, `pnpm-lock.yaml`, `pyproject.toml`, `poetry.lock`)]。
*   **依赖更新策略**: [如何以及何时更新依赖？(e.g., 定期审查, 使用 Dependabot, 谨慎处理主版本更新)。如何处理安全漏洞？]。

## 3. 前端指南 (Frontend Guidelines)
[本部分包含专注于前端开发的具体规范和实践]

### 3.1 UI 框架与技术栈 (UI Framework & Stack)
[明确前端核心技术选型]
*   **主要 UI 框架**: [例如：React 19, Vue 3, Angular 17, Svelte]。
*   **核心库**: [例如：TypeScript 5.x]。
*   **相关库**: [列出项目使用的关键辅助库，并说明选型理由（如果重要）。例如：状态管理 (Zustand), 路由 (React Router), 数据请求 (TanStack Query/SWR/Fetch API), UI 组件库 (Material UI/Ant Design/Radix)]。

### 3.2 状态管理策略 (State Management Strategy)
[定义前端状态管理的具体方法。考虑：UI 局部状态如何管理？跨组件共享状态多吗？是否需要全局方案？异步操作状态如何处理？当前项目阶段的务实选择是什么？]
*   **局部状态**: [例如：优先使用框架内置机制 (`useState`, `ref`)]。
*   **共享状态**: [例如：简单场景使用 Context API/Props Drilling，复杂场景引入 Zustand/Redux/Pinia]。明确选择标准。
*   **异步状态**: [例如：封装在自定义 Hooks 或 Service 中，使用 `useState`/`useReducer` 或特定库 (TanStack Query) 管理 loading/error/data 状态]。

### 3.3 组件设计与组织 (Component Design & Organization)
[如何构建和组织前端组件]
*   **组件化原则**: [例如：遵循单一职责，保持组件小而专注，区分容器/逻辑组件和展示/纯组件，Props 设计原则]。
*   **可复用组件库**:
    *   **策略**: [通用 UI 组件放哪里？(e.g., `src/components`) 功能相关的组件放哪里？(e.g., `src/features/[featureName]/components`)]。
    *   **工具**: [是否使用 Storybook 或类似工具进行组件开发、文档化和可视化测试？]。
*   **目录结构 (前端部分)**: [提供具体的前端目录结构示例，并添加注释说明关键目录的作用]
    ```
    frontend/                  # 前端根目录
    ├── public/                # 静态资源 (构建时直接复制)
    ├── src/
    │   ├── assets/            # 图片, 字体等本地资源
    │   ├── components/        # 通用、可复用的 UI 组件 (原子/分子级别)
    │   │   └── [featureName]/   # 例如: authentication, problem-solving
    │   │       ├── api/         # 该功能相关的 API 请求封装
    │   │       ├── components/  # 特定功能的 UI 组件 (组织/模板级别)
    │   │       ├── hooks/       # 特定功能的自定义 Hooks
    │   │       ├── store/       # 特定功能的状态管理 (如果适用)
    │   │       ├── types/       # 特定功能的类型定义
    │   │       ├── utils/       # 特定功能的工具函数
    │   │       └── index.ts     # 功能模块入口/导出
    │   ├── hooks/             # 通用自定义 Hooks (跨功能)
    │   ├── layouts/           # 页面布局组件
    │   ├── lib/               # 第三方库的封装或配置
    │   ├── providers/         # React Context Providers
    │   ├── services/          # 通用前端服务 (e.g., apiClient, analytics)
    │   ├── store/             # 全局状态管理 (如果使用库)
    │   ├── styles/            # 全局样式, 主题配置
    │   ├── types/             # 全局或共享类型定义
    │   ├── utils/             # 通用工具函数 (与业务无关)
    │   ├── App.tsx            # 应用根组件 (路由, 全局布局, Provider 挂载)
    │   └── main.tsx           # 应用入口 (渲染根组件, 初始化设置)
    ├── .env.example           # 环境变量示例文件
    ├── .eslintrc.json         # ESLint 配置
    ├── .prettierrc.json       # Prettier 配置
    ├── index.html             # HTML 入口模板
    ├── package.json           # 项目依赖与脚本
    ├── pnpm-lock.yaml         # 依赖锁定文件
    ├── postcss.config.js      # PostCSS 配置 (e.g., for Tailwind)
    ├── tailwind.config.js     # TailwindCSS 配置
    ├── tsconfig.json          # TypeScript 核心配置
    ├── tsconfig.node.json     # TypeScript Node 环境配置 (e.g., for Vite)
    └── vite.config.ts         # Vite 构建工具配置
    ```

### 3.4 样式方案 (Styling Approach)
[明确项目中如何处理 CSS 样式]
*   **选用方案**: [例如：TailwindCSS, CSS Modules, Styled Components, Emotion, SASS/LESS, BEM 命名约定]。
*   **规范与约定**: [例如：Tailwind - 如何组织自定义工具类和组件类？CSS Modules - 命名约定？Styled Components - 主题使用？]。

### 3.5 导航 (Routing/Navigation)
[前端页面路由管理]
*   **选用库/模式**: [例如：React Router, Vue Router, Next.js App Router/Pages Router]。
*   **配置**: [路由定义的方式和位置？(e.g., 集中配置, 文件约定路由)]。
*   **导航守卫/权限控制**: [如何实现页面访问权限控制？(e.g., 路由守卫, HOC)]。

### 3.6 前端错误处理实践 (Frontend Error Handling Practices)
[细化前端错误处理的具体做法]
*   **API 调用错误**: [在 Service/Hook 层如何处理不同 HTTP 状态码？如何向上传递错误？]。
*   **UI 反馈**: [具体使用哪些组件或模式来展示错误？(e.g., Toast, Alert, Inline message, Skeleton screen)]。
*   **错误边界 (Error Boundaries)**: [在哪些层级使用 Error Boundaries？降级 UI 如何设计？]。
*   **前端日志**: [是否将关键前端错误上报到监控系统 (e.g., Sentry)？]。

### 3.7 前端测试实践 (Frontend Testing Practices)
[细化前端测试策略]
*   **单元测试**:
    *   **工具**: [例如：Vitest/Jest, React Testing Library (RTL)]。
    *   **范围**: [哪些需要单元测试？(Hooks, Utils, Reducers/Store logic, 纯逻辑组件)]。
    *   **目标**: [验证逻辑正确性，覆盖边界条件]。
*   **集成测试**:
    *   **工具**: [例如：RTL, Mock Service Worker (MSW)]。
    *   **范围**: [测试组件与其依赖的交互 (Hooks, API Mocks, Context)。验证多个单元能否协同工作]。
    *   **API Mocking**: [强制使用 MSW 或类似工具模拟 API 行为]。
*   **端到端测试 (E2E)**:
    *   **工具**: [例如：Playwright, Cypress]。
    *   **范围**: [覆盖哪些核心用户流程？(e.g., 登录, 核心功能操作)]。
    *   **策略**: [自动化还是手动？执行频率？]。

### 3.8 前端编码规范 (Frontend Coding Standards)
[前端特定的编码规范]
*   **Linter/Formatter**: [明确 ESLint, Prettier 的配置文件路径和核心规则集 (e.g., `airbnb`, `plugin:react/recommended`, `plugin:@typescript-eslint/recommended`)]。
*   **命名约定**: [前端特定命名，例如：组件 (`PascalCase`), Hooks (`useCamelCase`), 常量 (`UPPER_SNAKE_CASE`), CSS 类 (如果不用工具库)]。
*   **TypeScript 使用**:
    *   启用 `strict` 模式。
    *   避免 `any`。
    *   优先 `interface` 定义对象，`type` 定义其他。
    *   模块导出规范。
*   **React/Vue/[其他框架] 实践**:
    *   [例如：React - 函数式组件, Hooks 规则, Props 定义, key 的使用; Vue - Composition API 优先, props/emit 规范]。
    *   **性能优化**: [何时以及如何使用 `memo`, `useMemo`, `useCallback`, `shouldComponentUpdate`, `virtualized lists`？强调避免过早优化]。
*   **代码质量检查命令**: [列出 `package.json` 中用于运行 Linting, Formatting, Type Checking 的具体命令]。

### 3.9 构建与部署 (Build & Deployment)
[前端应用的构建和部署流程]
*   **构建工具**: [例如：Vite, Webpack, Next.js Build, Parcel]。
*   **配置文件**: [构建工具配置文件的位置和关键配置项说明]。
*   **构建命令**: [列出 `package.json` 中的开发和生产构建命令]。
*   **环境变量管理**:
    *   [明确使用 `.env` 文件的方式 (e.g., `.env`, `.env.development`, `.env.production`)]。
    *   [强调客户端环境变量需要特定前缀 (e.g., `VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`)]。
    *   [`.env` 文件不提交，但需要 `.env.example` 文件]。
*   **部署方式**: [具体部署到哪里？(e.g., Vercel, Netlify, AWS S3/CloudFront, Docker)。部署流程是手动的还是自动化的 (CI/CD)？]。
*   **优化**: [是否启用了代码分割、懒加载、资源压缩、图片优化等？]。

## 4. 后端指南 (Backend Guidelines)
[本部分包含专注于后端开发的具体规范和实践]

### 4.1 框架与技术栈 (Framework & Stack)
[明确后端核心技术选型]
*   **主要框架**: [例如：FastAPI, Express, NestJS, Spring Boot, Django, Ruby on Rails]。
*   **语言**: [例如：Python 3.10+, Node.js LTS, Java 17+, Go 1.x]。
*   **数据库**: [例如：PostgreSQL, MySQL, MongoDB, Redis]。
*   **ORM/数据库驱动**: [例如：SQLAlchemy + Alembic, Prisma, TypeORM, Spring Data JPA, GORM]。
*   **包管理/构建工具**: [例如：uv/Poetry (Python), npm/pnpm (Node.js), Maven/Gradle (Java)]。

### 4.2 API 层设计 (API Layer Design)
[API 接口的设计规范]
*   **路由组织**: [如何组织路由？(e.g., 按资源/功能模块化, FastAPI Routers, Express Routers)]。
*   **请求验证与序列化**: [使用什么库？(e.g., Pydantic, class-validator, Zod)。验证规则定义在哪里？如何处理验证错误？]。
*   **身份认证与授权**: [采用什么机制？(e.g., JWT, OAuth2, Session)。如何实现？(e.g., 中间件, 装饰器, 守卫)]。

### 4.3 服务层设计 (Service Layer Design)
[业务逻辑层的设计原则]
*   **职责**: [封装核心业务逻辑，协调数据访问，处理事务，保持独立性]。
*   **原则**: [例如：单一职责，依赖倒置 (依赖抽象而非具体实现)]。

### 4.4 数据访问层设计 (Data Access Layer Design)
[与数据源交互的规范]
*   **模式**: [例如：Repository Pattern, DAO Pattern, Active Record (慎用)]。
*   **职责**: [定义数据操作接口，封装 ORM 或数据库驱动细节]。
*   **ORM 使用规范**: [例如：避免泄露 ORM 实体到上层，事务管理策略，查询优化]。

### 4.5 依赖注入 (Dependency Injection)
[后端依赖管理和注入方式]
*   **选用框架/方式**: [例如：FastAPI Depends, NestJS DI, Spring DI, Guice, 手动注入]。
*   **范围与生命周期**: [哪些对象需要注入？生命周期如何管理？(e.g., Singleton, Scoped, Transient)]。

### 4.6 后端错误处理实践 (Backend Error Handling Practices)
[细化后端错误处理]
*   **异常处理机制**: [例如：使用全局异常处理器/中间件捕获错误]。
*   **HTTP 状态码**: [遵循标准的 HTTP 状态码语义]。
*   **结构化错误响应**: [定义统一的错误响应 JSON 结构 (e.g., `{ "code": "ERR_CODE", "message": "...", "details": ... }`)]。
*   **日志**: [在异常处理器中记录详细错误上下文]。

### 4.7 后端测试实践 (Backend Testing Practices)
[细化后端测试策略]
*   **单元测试**:
    *   **工具**: [例如：Pytest (Python), Jest (Node.js), JUnit (Java)]。
    *   **范围**: [Service 层逻辑, Utils, Repository Mocks, 纯逻辑函数]。
    *   **Mocking**: [例如：`unittest.mock` (Python), Jest Mocks, Mockito (Java)]。
*   **集成测试**:
    *   **工具**: [例如：FastAPI TestClient, Supertest (Node.js), Spring Boot Test]。
    *   **范围**: [API 端点测试 (Mock 掉外部依赖), Service 与真实数据库 (测试库) 交互测试]。

### 4.8 后端编码规范 (Backend Coding Standards)
[后端特定的编码规范]
*   **Linter/Formatter**: [明确 Ruff/Black/isort (Python), ESLint/Prettier (Node.js), Checkstyle (Java) 的配置文件和规则集]。
*   **类型提示**: [例如：强制 Python Type Hints 并用 Mypy 检查，强制 TypeScript]。
*   **异步处理**: [如果使用异步框架 (FastAPI, Node.js)，描述 `async/await` 的使用规范，避免阻塞 I/O]。
*   **命名约定**: [例如：Python - 类 `PascalCase`, 函数/变量 `snake_case`; Java - 类 `PascalCase`, 方法/变量 `camelCase`]。
*   **代码质量检查命令**: [列出用于运行 Linting, Formatting, Type Checking 的具体命令]。

### 4.9 数据库规范 (Database Guidelines)
[数据库设计和使用的规范]
*   **Schema 设计**: [命名规范 (表, 列 - e.g., `snake_case`), 数据类型选择, 索引策略, 关系 (外键) 设计, 是否使用软删除？]。
*   **迁移管理**:
    *   **工具**: [例如：Alembic (SQLAlchemy), Prisma Migrate, Flyway/Liquibase (Java)]。
    *   **流程**: [迁移文件的编写规范、审查流程、应用策略 (手动/自动？)]。
*   **查询优化**: [基本的查询性能考虑点，避免 N+1 问题]。

### 4.10 部署与基础设施 (Deployment & Infrastructure)
[后端应用的部署和运维相关规范]
*   **容器化**: [推荐使用 Docker。提供 `Dockerfile` 最佳实践 (多阶段构建, 非 root 用户运行)]。
*   **环境变量管理**: [推荐使用 `.env` 文件 (配合 `python-dotenv` 或类似库) 或配置中心管理配置和密钥]。
*   **日志配置 (生产环境)**: [配置结构化日志 (JSON) 输出到 stdout/stderr (容器化友好) 或文件。使用日志库 (Python `logging`, `loguru`; Node.js `pino`)。控制日志级别。集成日志聚合服务？]。
*   **部署目标**: [例如：云服务器 (EC2), 容器服务 (ECS, Kubernetes), PaaS (Heroku, Render)]。
*   **CI/CD**: [描述 CI (构建, 测试, 镜像构建) 和 CD (部署到各环境) 的流程和工具 (GitHub Actions, GitLab CI, Jenkins)]。
*   **[可选] 监控与告警**: [使用哪些工具进行应用性能监控 (APM) 和基础设施监控？关键告警指标？]。
*   **目录结构 (后端部分)**: [提供具体的后端目录结构示例，并添加注释说明关键目录的作用]
    ```
    backend/                  # 后端根目录
    ├── src/                  # 源代码目录
    │   ├── apis/             # API 层 (路由/控制器)
    │   │   └── v1/             # API 版本
    │   ├── core/             # 核心配置 (应用实例, 设置, DB 连接等)
    │   ├── models/           # 数据库模型 (ORM 定义, 如果使用)
    │   ├── repositories/     # 数据访问层 (Repository Pattern 实现)
    │   ├── schemas/          # API 数据模型 (Pydantic/DTOs)
    │   ├── services/         # 业务逻辑层
    │   ├── utils/            # 通用工具函数
    │   └── main.py           # 应用入口 (创建 FastAPI/Express 实例)
    ├── tests/                # 测试代码
    │   ├── unit/             # 单元测试
    │   ├── integration/      # 集成测试
    │   └── conftest.py       # Pytest 配置文件 (如果使用)
    ├── alembic/              # 数据库迁移脚本 (如果使用 Alembic)
    ├── .env.example          # 环境变量示例
    ├── .gitignore
    ├── Dockerfile            # Docker 镜像构建文件
    ├── mypy.ini              # Mypy 配置
    ├── pyproject.toml        # 项目元数据, 依赖, 工具配置 (uv/Poetry)
    ├── pytest.ini            # Pytest 配置
    └── README.md             # 后端说明文档
    ```

## 5. 总结 (Conclusion)

重申本开发指南的重要性，强调团队成员（包括 AI 协作者）应遵循的原则。说明文档的维护和更新机制 ([例如：负责人, 更新频率, 评审流程])。

## 6. 附录 (Appendix)

*   **相关文档链接 (Related Links):**
    *   [链接到相关 概念文档、Version PRD、技术文档等。]
*   **版本历史 (Revision History):**
    | 版本  | 更新时间   | 修改描述       | 修改人 |
    | ----- | -------- | ------------ | ---- |
    | 1.0   | [日期]    | 初始创建       | [名字] |
    | ...   | ...      | ...          | ...  |
