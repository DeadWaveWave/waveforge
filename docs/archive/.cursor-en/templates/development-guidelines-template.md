> File naming format template: development-guidelines.md
> File path: docs/development/

# [Project Name] - Development Guidelines

**Version**: 1.0
**Last Updated**: [YYYY-MM-DD]
**Author**: [Author/Team Name]
**Status**: [e.g., Draft, Active, Deprecated]

## 1. Introduction

### 1.1 Purpose of This Document

This document defines the core architectural principles, design patterns, and development standards for the [Project Name] application/system. It aims to ensure code consistency, maintainability, testability, and extensibility, providing a unified development standard for all team members (including AI collaborators) to reduce communication overhead, improve development efficiency, and enhance product quality.

### 1.2 [Optional] Project Overview / Tech Stack Overview

[Briefly introduce the project's goals (can reference the Version PRD), core features, and the main technology stack used, providing context for the subsequent guidelines. e.g., This project is an AI-powered learning companion prototype using a React frontend and a FastAPI backend...]

## 2. Common Guidelines

[This section contains principles and standards applicable to all parts of the project or across the frontend and backend.]

### 2.1 High-Level Architecture Principles

[Define the fundamental principles guiding the overall project architecture.]

- **Architectural Goals**: [Define and prioritize architectural goals based on the project phase (e.g., MVP, mature) and Version PRD objectives. How to balance rapid iteration with long-term maintenance?]
  - **Simplicity & Readability**: [e.g., Code should be easy to understand; prefer simple and direct implementations.]
  - **Consistency**: [e.g., Follow the standards defined in this document; use code style tools to ensure uniformity.]
  - **Testability**: [e.g., Architectural design should support unit, integration, and end-to-end testing. How to achieve decoupling?]
  - **Maintainability**: [e.g., Clear module division, separation of concerns, documentation. How to reduce modification costs?]
  - **Scalability/Extensibility**: [e.g., Modular design, interface reservations, adapting to future needs. How to handle user growth or feature additions?]
  - **(Optional) Other Goals**: [e.g., Performance, Security, Reliability, Rapid Iteration]
- **High-Level Architecture Diagram (Example: Frontend-Backend Separation)**: [Draw a concise architecture diagram showing core components and their main interactions. Mermaid is recommended.]
  ```mermaid
  graph LR
      subgraph Browser/Client
          A[UI Components]
          B["Frontend Logic/State (e.g., Hooks, Services, State Mgmt)"]
      end
      subgraph Server
          C["Backend API (e.g., REST, GraphQL)"]
          D[Business Logic/Service Layer]
          E["Data Access Layer (DAL)"]
          F[Database/External Services]
      end
      A -- "User Action" --> B
      B -- "API Request" --> C
      C -- "Calls" --> D
      D -- "Calls" --> E
      E -- "Accesses" --> F
      F -- "Data" --> E
      E -- "Data" --> D
      D -- "Result" --> C
      C -- "API Response" --> B
      B -- "Updates State" --> A
  ```
- **[Optional] Key Architectural Decisions**: [Document important architectural choices and their rationale, e.g., Why choose frontend-backend separation? Why choose a specific framework?]

### 2.2 Documentation Ecosystem

- **Purpose**: To guide development and maintenance work clearly and efficiently, we use several types of documents, each with a specific role:
  - **Product Requirement Documents (PRD - Version & Story)**: Define "why we are building" (background, goals) and "what to build" (user stories, scope, acceptance criteria). Located in `docs/product/prd/`.
  - **Development Guidelines (This Document)**: Define "how to build" (technical standards, architectural principles, coding standards, workflow).
  - **Feature Docs**: Describe "what features the system has" and "where the key implementations are" (functional module breakdown, code entry points, exposed interfaces). Located in `docs/product/features/`.
  - **Devlogs**: Record the "development process" (task execution steps, problems encountered, decision records). Located in `docs/product/prd/[prd-version]/devlogs/` and `.cursor/devlogs/`.
- **Relationship**: These documents complement each other and together form the project's knowledge base. Relevant documents should be consulted, referenced, and maintained as needed during development.

### 2.3 Version Control & Git Workflow

[Define the team's version control process.]

- **Branching Strategy**: [Specify the branching model, e.g., GitFlow (main, develop, feature/*, release/*, hotfix/*), GitHub Flow (main, feature/*), or a project-specific simplified flow. Which branch is stable? Where are new features/fixes developed?]
- **Commit Message Convention**: [e.g., Enforce adherence to the Conventional Commits specification (`<type>(<scope>): <subject>`) to facilitate Change Log generation and understanding of commit history.]
- **Code Review Requirements**: [Is a Code Review required before merging into key branches (e.g., main, develop)? How many reviewers are needed? What are the key points of the review? Who is responsible for reviewing?]
- **Pre-commit Checks**: [What checks must developers run locally before committing? (e.g., Linting, Formatting, Tests)]

### 2.4 API Interaction & Contract

[Define standards for API design and maintenance between frontend, backend, or other services.]

- **API Design Style**: [e.g., RESTful API (adhering to standard HTTP methods and status codes), GraphQL].
- **API Documentation Standard**:
  - How to define and maintain API documentation? [e.g., Mandate using OpenAPI (Swagger) with auto-generation of `openapi.json` from the backend framework, using a Postman Collection, or maintaining a GraphQL Schema.]
  - What information should the documentation include? [Path, method, parameters, request/response body examples, error codes, etc.].
- **Frontend-Backend Type Synchronization Mechanism**: [How to ensure data structures are consistent between frontend and backend?]
  - **Strongly Recommended**: Use code generation tools ([e.g., openapi-typescript-codegen, GraphQL Code Generator]) to automatically generate frontend type definitions based on the API specification.
  - **Forbidden**: Manually writing/synchronizing API type definitions.
  - The project should include corresponding generation scripts ([e.g., `npm run gen:types`]) and integrate them into the development process.
- **API Versioning**: [How are API versions managed? e.g., URL path versioning (/v1/, /v2/), Header versioning, or no explicit versioning for now?]

### 2.5 General Coding Standards

[Basic coding rules applicable to all code in the project.]

- **Base Language Standards**: [Link to the official style guide or a widely accepted community standard for the primary language used, e.g., PEP 8 (Python), Airbnb JavaScript Style Guide, Google Java Style Guide.]
- **Naming Conventions**: [Define general naming conventions covering files, directories, constants, etc. Language/framework-specific naming conventions can be detailed in their respective sections.]
- **Commenting Standards**:
  - **Principle**: [When are comments necessary? (e.g., to explain complex logic, algorithms, workarounds, important decision rationale). What kind of comments to avoid? (e.g., restating the code)].
  - **TODO/FIXME**: [Define a standard format and handling process (`// TODO: [Description] (@owner optional)`).]
- **Code Style & Formatting Tools**: [Key to ensuring consistency.]
  - **Mandatory Use**: [Specify the code formatting tools (e.g., Prettier, Black, gofmt) and linters (e.g., ESLint, Ruff, Checkstyle, RuboCop) used in the project.]
  - **Configuration Files**: [Configuration files (e.g., `.prettierrc`, `pyproject.toml`, `.eslintrc.json`) should be under version control.]
  - **CI Integration**: [Is code style enforced in the CI pipeline?].

### 2.6 Error Handling Principles

[Define the general strategy for error handling.]

- **Error Classification & Definition**: [How to distinguish between different types of errors? (e.g., user input errors, business logic errors, third-party service errors, internal system errors). Is there a unified error code or error object structure?].
- **Error Propagation**: [How are errors passed between different layers/services? (e.g., throwing specific exceptions, returning a Result object containing error information)].
- **Basic Logging Requirements**: [All uncaught or critical errors should be logged. What information should logs contain for easy troubleshooting? (Trace ID, timestamp, error details, context)].
- **Sensitive Information Handling**: [Emphasize not exposing sensitive data in error messages and logs].

### 2.7 Testing Strategy Principles

[Define the basic approach and goals for testing.]

- **Testing Philosophy**: [e.g., Follow the Testing Pyramid (or Diamond/Honeycomb), clarifying the investment ratio and focus for each type of test. Is TDD/BDD applicable?].
- **Test Type Definitions**: [Clearly define the meaning and boundaries of unit, integration, and end-to-end tests in the project.]
  - **Unit Tests**: [Test goal? (e.g., logic of a single function, class, module). Are dependencies mocked?].
  - **Integration Tests**: [Test goal? (e.g., interaction between modules, interaction with mocked external services, API endpoints)].
  - **End-to-End (E2E) Tests**: [Test goal? (e.g., simulating real user scenarios, covering critical business flows). Manual or automated?].
- **Test Coverage**: [Is there a target? How is it measured? Emphasize a rational view of coverage numbers].

### 2.8 Dependency Management

[How to manage the project's external dependencies.]

- **Package Managers**: [Specify the package managers used for different parts of the project, e.g., pnpm/yarn/npm (frontend), uv/Poetry/pip (backend)].
- **Dependency Files**: [Specify which dependency files need to be under version control (e.g., `package.json`, `pnpm-lock.yaml`, `pyproject.toml`, `poetry.lock`)].
- **Dependency Update Strategy**: [How and when to update dependencies? (e.g., regular reviews, using Dependabot, cautious with major version updates). How to handle security vulnerabilities?].

## 3. Frontend Guidelines

[This section contains specific standards and practices focused on frontend development.]

### 3.1 UI Framework & Stack

[Specify the core frontend technology choices.]

- **Main UI Framework**: [e.g., React 19, Vue 3, Angular 17, Svelte].
- **Core Language**: [e.g., TypeScript 5.x].
- **Related Libraries**: [List key auxiliary libraries used in the project and state the reasons for their selection if important. e.g., State Management (Zustand), Routing (React Router), Data Fetching (TanStack Query/SWR/Fetch API), UI Component Library (Material UI/Ant Design/Radix)].

### 3.2 State Management Strategy

[Define the specific approach to frontend state management. Consider: How is local UI state managed? Is there much cross-component shared state? Is a global solution needed? How is asynchronous operation state handled? What is a pragmatic choice for the current project phase?]

- **Local State**: [e.g., Prefer using the framework's built-in mechanisms (`useState`, `ref`)].
- **Shared State**: [e.g., Use Context API/Props Drilling for simple scenarios, introduce Zustand/Redux/Pinia for complex ones]. Clarify selection criteria.
- **Async State**: [e.g., Encapsulate in custom Hooks or Services, manage loading/error/data states using `useState`/`useReducer` or a dedicated library (TanStack Query)].

### 3.3 Component Design & Organization

[How to build and organize frontend components.]

- **Componentization Principles**: [e.g., Follow Single Responsibility Principle, keep components small and focused, distinguish between container/logic components and presentational/pure components, props design principles].
- **Reusable Component Library**:
  - **Strategy**: [Where to put generic UI components? (e.g., `src/components`) Where to put feature-related components? (e.g., `src/features/[featureName]/components`)].
  - **Tooling**: [Do you use Storybook or similar tools for component development, documentation, and visual testing?].
- **Directory Structure (Frontend Part)**: [Provide a concrete example of the frontend directory structure with comments explaining the role of key directories.]
  ```
  frontend/                  # Frontend root directory
  ├── public/                # Static assets (copied directly during build)
  ├── src/
  │   ├── assets/            # Local assets like images, fonts
  │   ├── components/        # Generic, reusable UI components (atomic/molecular level)
  │   ├── features/          # Feature-based modules
  │   │   └── [featureName]/   # e.g., authentication, problem-solving
  │   │       ├── api/         # API request wrappers for this feature
  │   │       ├── components/  # UI components specific to this feature (organism/template level)
  │   │       ├── hooks/       # Custom Hooks specific to this feature
  │   │       ├── store/       # State management for this feature (if applicable)
  │   │       ├── types/       # Type definitions for this feature
  │   │       ├── utils/       # Utility functions for this feature
  │   │       └── index.ts     # Feature module entry point/exports
  │   ├── hooks/             # Generic custom Hooks (cross-feature)
  │   ├── layouts/           # Page layout components
  │   ├── lib/               # Wrappers or configurations for third-party libraries
  │   ├── providers/         # React Context Providers
  │   ├── services/          # Generic frontend services (e.g., apiClient, analytics)
  │   ├── store/             # Global state management (if using a library)
  │   ├── styles/            # Global styles, theme configuration
  │   ├── types/             # Global or shared type definitions
  │   ├── utils/             # Generic utility functions (not business-related)
  │   ├── App.tsx            # Root application component (routing, global layout, provider setup)
  │   └── main.tsx           # Application entry point (renders root component, initial setup)
  ├── .env.example           # Environment variable example file
  ├── .eslintrc.json         # ESLint configuration
  ├── .prettierrc.json       # Prettier configuration
  ├── index.html             # HTML entry template
  ├── package.json           # Project dependencies and scripts
  ├── pnpm-lock.yaml         # Dependency lock file
  ├── postcss.config.js      # PostCSS configuration (e.g., for Tailwind)
  ├── tailwind.config.js     # TailwindCSS configuration
  ├── tsconfig.json          # Core TypeScript configuration
  ├── tsconfig.node.json     # TypeScript Node environment config (e.g., for Vite)
  └── vite.config.ts         # Vite build tool configuration
  ```

### 3.4 Styling Approach

[Specify how CSS styles are handled in the project.]

- **Chosen Solution**: [e.g., TailwindCSS, CSS Modules, Styled Components, Emotion, SASS/LESS, BEM naming convention].
- **Standards & Conventions**: [e.g., for Tailwind - how to organize custom utilities and component classes? for CSS Modules - naming conventions? for Styled Components - theme usage?].

### 3.5 Routing/Navigation

[Frontend page routing management.]

- **Chosen Library/Pattern**: [e.g., React Router, Vue Router, Next.js App Router/Pages Router].
- **Configuration**: [How and where are routes defined? (e.g., centralized config, file-based routing)].
- **Navigation Guards/Auth Control**: [How to implement page access control? (e.g., route guards, HOC)].

### 3.6 Frontend Error Handling Practices

[Detail specific practices for frontend error handling.]

- **API Call Errors**: [How to handle different HTTP status codes at the Service/Hook layer? How to propagate errors upward?].
- **UI Feedback**: [Which specific components or patterns are used to display errors? (e.g., Toast, Alert, Inline message, Skeleton screen)].
- **Error Boundaries**: [At which levels are Error Boundaries used? How are fallback UIs designed?].
- **Frontend Logging**: [Are critical frontend errors reported to a monitoring system (e.g., Sentry)?].

### 3.7 Frontend Testing Practices

[Detail the frontend testing strategy.]

- **Unit Tests**:
  - **Tools**: [e.g., Vitest/Jest, React Testing Library (RTL)].
  - **Scope**: [What needs unit tests? (Hooks, Utils, Reducers/Store logic, pure logic components)].
  - **Goal**: [Verify logical correctness, cover boundary conditions].
- **Integration Tests**:
  - **Tools**: [e.g., RTL, Mock Service Worker (MSW)].
  - **Scope**: [Test a component's interaction with its dependencies (Hooks, API Mocks, Context). Verify that multiple units work together].
  - **API Mocking**: [Mandate using MSW or a similar tool to mock API behavior].
- **End-to-End (E2E) Tests**:
  - **Tools**: [e.g., Playwright, Cypress].
  - **Scope**: [Which core user flows are covered? (e.g., login, core feature operations)].
  - **Strategy**: [Automated or manual? Execution frequency?].

### 3.8 Frontend Coding Standards

[Frontend-specific coding standards.]

- **Linter/Formatter**: [Specify paths for ESLint, Prettier config files and core rule sets (e.g., `airbnb`, `plugin:react/recommended`, `plugin:@typescript-eslint/recommended`)].
- **Naming Conventions**: [Frontend-specific naming, e.g., Components (`PascalCase`), Hooks (`useCamelCase`), Constants (`UPPER_SNAKE_CASE`), CSS classes (if not using a utility library)].
- **TypeScript Usage**:
  - Enable `strict` mode.
  - Avoid `any`.
  - Prefer `interface` for defining objects, `type` for others.
  - Module export conventions.
- **React/Vue/[Other Framework] Practices**:
  - [e.g., for React - functional components, Rules of Hooks, props definition, key usage; for Vue - Composition API first, props/emit standards].
  - **Performance Optimization**: [When and how to use `memo`, `useMemo`, `useCallback`, `shouldComponentUpdate`, `virtualized lists`? Emphasize avoiding premature optimization].
- **Code Quality Check Commands**: [List the specific commands in `package.json` for running Linting, Formatting, and Type Checking].

### 3.9 Build & Deployment

[The build and deployment process for the frontend application.]

- **Build Tool**: [e.g., Vite, Webpack, Next.js Build, Parcel].
- **Configuration Files**: [Location of build tool config files and explanation of key settings].
- **Build Commands**: [List the development and production build commands from `package.json`].
- **Environment Variable Management**:
  - [Specify how `.env` files are used (e.g., `.env`, `.env.development`, `.env.production`)].
  - [Emphasize that client-side environment variables need a specific prefix (e.g., `VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`)].
  - [`.env` files are not committed, but an `.env.example` file is required].
- **Deployment Method**: [Where is it deployed? (e.g., Vercel, Netlify, AWS S3/CloudFront, Docker). Is the deployment process manual or automated (CI/CD)?].
- **Optimization**: [Are code splitting, lazy loading, asset compression, image optimization, etc., enabled?].

## 4. Backend Guidelines

[This section contains specific standards and practices focused on backend development.]

### 4.1 Framework & Stack

[Specify core backend technology choices.]

- **Main Framework**: [e.g., FastAPI, Express, NestJS, Spring Boot, Django, Ruby on Rails].
- **Language**: [e.g., Python 3.10+, Node.js LTS, Java 17+, Go 1.x].
- **Database**: [e.g., PostgreSQL, MySQL, MongoDB, Redis].
- **ORM/Database Driver**: [e.g., SQLAlchemy + Alembic, Prisma, TypeORM, Spring Data JPA, GORM].
- **Package Management/Build Tool**: [e.g., uv/Poetry (Python), npm/pnpm (Node.js), Maven/Gradle (Java)].

### 4.2 API Layer Design

[Design standards for the API interface.]

- **Route Organization**: [How are routes organized? (e.g., modularized by resource/feature, FastAPI Routers, Express Routers)].
- **Request Validation & Serialization**: [What library is used? (e.g., Pydantic, class-validator, Zod). Where are validation rules defined? How are validation errors handled?].
- **Authentication & Authorization**: [What mechanism is used? (e.g., JWT, OAuth2, Session). How is it implemented? (e.g., middleware, decorators, guards)].

### 4.3 Service Layer Design

[Design principles for the business logic layer.]

- **Responsibilities**: [Encapsulate core business logic, coordinate data access, handle transactions, maintain independence].
- **Principles**: [e.g., Single Responsibility, Dependency Inversion (depend on abstractions, not concrete implementations)].

### 4.4 Data Access Layer Design

[Standards for interacting with data sources.]

- **Patterns**: [e.g., Repository Pattern, DAO Pattern, Active Record (use with caution)].
- **Responsibilities**: [Define data manipulation interfaces, encapsulate ORM or database driver details].
- **ORM Usage Standards**: [e.g., Avoid leaking ORM entities to upper layers, transaction management strategies, query optimization].

### 4.5 Dependency Injection

[Backend dependency management and injection method.]

- **Chosen Framework/Method**: [e.g., FastAPI Depends, NestJS DI, Spring DI, Guice, manual injection].
- **Scope & Lifetime**: [Which objects need to be injected? How are their lifetimes managed? (e.g., Singleton, Scoped, Transient)].

### 4.6 Backend Error Handling Practices

[Detail backend error handling.]

- **Exception Handling Mechanism**: [e.g., Use a global exception handler/middleware to catch errors].
- **HTTP Status Codes**: [Follow standard HTTP status code semantics].
- **Structured Error Response**: [Define a uniform JSON structure for error responses (e.g., `{ "code": "ERR_CODE", "message": "...", "details": ... }`)].
- **Logging**: [Log detailed error context in the exception handler].

### 4.7 Backend Testing Practices

[Detail the backend testing strategy.]

- **Unit Tests**:
  - **Tools**: [e.g., Pytest (Python), Jest (Node.js), JUnit (Java)].
  - **Scope**: [Service layer logic, Utils, Repository Mocks, pure logic functions].
  - **Mocking**: [e.g., `unittest.mock` (Python), Jest Mocks, Mockito (Java)].
- **Integration Tests**:
  - **Tools**: [e.g., FastAPI TestClient, Supertest (Node.js), Spring Boot Test].
  - **Scope**: [API endpoint tests (mocking external dependencies), Service interaction with a real test database].

### 4.8 Backend Coding Standards

[Backend-specific coding standards.]

- **Linter/Formatter**: [Specify config files and rule sets for Ruff/Black/isort (Python), ESLint/Prettier (Node.js), Checkstyle (Java)].
- **Type Hinting**: [e.g., Enforce Python Type Hints and check with Mypy, enforce TypeScript].
- **Asynchronous Handling**: [If using an async framework (FastAPI, Node.js), describe `async/await` usage standards, avoid blocking I/O].
- **Naming Conventions**: [e.g., Python - classes `PascalCase`, functions/variables `snake_case`; Java - classes `PascalCase`, methods/variables `camelCase`].
- **Code Quality Check Commands**: [List the specific commands for running Linting, Formatting, and Type Checking].

### 4.9 Database Guidelines

[Standards for database design and usage.]

- **Schema Design**: [Naming conventions (tables, columns - e.g., `snake_case`), data type selection, indexing strategy, relationship (foreign key) design, use of soft deletes?].
- **Migration Management**:
  - **Tools**: [e.g., Alembic (SQLAlchemy), Prisma Migrate, Flyway/Liquibase (Java)].
  - **Process**: [Migration file writing standards, review process, application strategy (manual/automatic?)].
- **Query Optimization**: [Basic query performance considerations, avoiding the N+1 problem].

### 4.10 Deployment & Infrastructure

[Deployment and operations-related standards for the backend application.]

- **Containerization**: [Recommend using Docker. Provide `Dockerfile` best practices (multi-stage builds, non-root user execution)].
- **Environment Variable Management**: [Recommend using `.env` files (with `python-dotenv` or similar libraries) or a configuration center to manage configs and secrets].
- **Logging Configuration (Production)**: [Configure structured logging (JSON) to stdout/stderr (container-friendly) or files. Use a logging library (Python `logging`, `loguru`; Node.js `pino`). Control log levels. Integrate with a log aggregation service?].
- **Deployment Target**: [e.g., Cloud Server (EC2), Container Service (ECS, Kubernetes), PaaS (Heroku, Render)].
- **CI/CD**: [Describe the CI (build, test, image creation) and CD (deployment to various environments) process and tools (GitHub Actions, GitLab CI, Jenkins)].
- **[Optional] Monitoring & Alerting**: [What tools are used for Application Performance Monitoring (APM) and infrastructure monitoring? Key alert metrics?].
- **Directory Structure (Backend Part)**: [Provide a concrete example of the backend directory structure with comments explaining the role of key directories.]
  ```
  backend/                  # Backend root directory
  ├── src/                  # Source code directory
  │   ├── apis/             # API layer (routes/controllers)
  │   │   └── v1/             # API version
  │   ├── core/             # Core configuration (app instance, settings, DB connection, etc.)
  │   ├── models/           # Database models (ORM definitions, if used)
  │   ├── repositories/     # Data Access Layer (Repository Pattern implementation)
  │   ├── schemas/          # API data models (Pydantic/DTOs)
  │   ├── services/         # Business logic layer
  │   ├── utils/            # Generic utility functions
  │   └── main.py           # Application entry point (creates FastAPI/Express instance)
  ├── tests/                # Test code
  │   ├── unit/             # Unit tests
  │   ├── integration/      # Integration tests
  │   └── conftest.py       # Pytest configuration file (if using)
  ├── alembic/              # Database migration scripts (if using Alembic)
  ├── .env.example          # Environment variable example
  ├── .gitignore
  ├── Dockerfile            # Docker image build file
  ├── mypy.ini              # Mypy configuration
  ├── pyproject.toml        # Project metadata, dependencies, tool config (uv/Poetry)
  ├── pytest.ini            # Pytest configuration
  └── README.md             # Backend-specific README
  ```

## 5. Conclusion

Reiterate the importance of these development guidelines and emphasize the principles that team members (including AI collaborators) should follow. Explain the maintenance and update mechanism for the document ([e.g., responsible person, update frequency, review process]).

## 6. Appendix

- **Related Links:**
  - [Link to related Concept Documents, Version PRDs, technical docs, etc.]
- **Revision History:**
  | Version | Last Updated | Description of Changes | Modified By |
  | ------- | ------------ | ---------------------- | ----------- |
  | 1.0 | [Date] | Initial creation | [Name] |
  | ... | ... | ... | ... |
