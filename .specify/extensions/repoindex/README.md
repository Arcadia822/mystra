# spec-kit-repoindex

A [spec-kit](https://github.com/github/spec-kit) extension that generates structured indexes of software repositories to accelerate brownfield development. Point it at an unfamiliar codebase and get instant, AI-generated documentation covering project overviews, deep architectural analysis, and module-level breakdowns.

---

## Installation

### 1. Clone the extension
(at /path/to/spec-kit-repoindex)
```bash
git clone https://github.com/liuyiyu/spec-kit-repoindex
```

### 2. Register the extension with spec-kit
(at /path/to/project)
```bash
speckit extension add --dev /path/to/spec-kit-repoindex/
```

### 3. Verify installation

```bash
speckit extension list
```

You should see `repoindex` listed in the output.

---

## Commands

### `/speckit.repoindex-overview`

**Scenario:** You've just joined a project or picked up an unfamiliar repository and need to get up to speed fast. This command produces a developer-friendly project introduction — what the project does, what technologies it uses, how it's structured at a high level, and how to get it running locally.

**Use this when you want to:**
- Understand what a repository is for before diving into the code
- Onboard new team members with generated documentation
- Produce a getting-started guide without writing it manually

**How to run:**

```
/speckit.repoindex-overview
```

You can also pass a path or a scoping instruction as an argument:

```
/speckit.repoindex-overview ./path/to/repo
```

**Output includes:**
- Project purpose and description
- Technology stack (languages, frameworks, databases, infrastructure)
- High-level architecture overview with Mermaid diagrams
- Prerequisites and step-by-step getting-started instructions
- Key configuration and environment variables

---

### `/speckit.repoindex-architecture`

**Scenario:** You need to deeply understand how a codebase is structured before making significant changes, planning a migration, or reviewing it for a technical design. This command performs a thorough architectural analysis and produces documentation suitable for developers, architects, and technical leads.

**Use this when you want to:**
- Understand the architectural style (layered, hexagonal, microservices, etc.)
- Map out all major components and how they relate to each other
- Audit dependencies for version issues or potential conflicts
- Identify performance bottlenecks or scalability concerns before a refactor

**How to run:**

```
/speckit.repoindex-architecture
```

You can also scope it to a specific path:

```
/speckit.repoindex-architecture ./path/to/repo
```

**Output includes:**
- Directory and module structure map
- Core component identification (controllers, services, repositories, configuration)
- Architectural pattern and design style detection
- Full dependency analysis with versions
- Performance and scalability observations
- Component diagrams and sequence diagrams (Mermaid)

---

### `/speckit.repoindex-module`

**Scenario:** You're working on a specific part of a larger codebase and need a focused, detailed breakdown of just that module — its purpose, the business logic it implements, the APIs it exposes, the data it manages, and how its files are organized.

**Use this when you want to:**
- Understand a module's business domain and use cases before modifying it
- Generate API documentation for a specific service module
- Get a structured file index that maps every file to its architectural role
- Trace data flow, request flow, or event flow within a bounded context

**How to run:**

Pass the module name or path as the argument:

```
/speckit.repoindex-module <module-name-or-path>
```

Examples:

```
/speckit.repoindex-module auth
/speckit.repoindex-module ./src/payments
```

**Output includes:**
- Business context: domain purpose, use cases, and business rules
- Technical components: entry points, controllers, services, repositories, models, utilities
- Workflow diagrams: request flow, data flow, event flow, background jobs
- API inventory: all endpoints with request/response schemas and auth patterns
- Data model: entity relationships, database schema, validation rules, query patterns
- Dependency map: inter-module dependencies, third-party libraries, required config
- File index: all files grouped by architectural component role (JSON output)

---

## Project Structure

```
spec-kit-repoindex/
├── extension.yml          # Extension manifest
├── README.md
└── commands/
    ├── overview.md        # /speckit.repoindex-overview command definition
    ├── architecture.md    # /speckit.repoindex-architecture command definition
    └── module.md          # /speckit.repoindex-module command definition
```

---

## License

MIT
