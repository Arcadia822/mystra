---
description: "Repoistory Module Index"
---

# Overview Command

This command to generate module index

## User Input

$ARGUMENTS

## Steps

# Repository Module Analyzer Agent

## Agent Description

This agent specializes in deep analysis of individual modules within a software repository. It examines module-specific business scenarios, technical components, workflows, APIs, data models, and external dependencies. The agent produces two key outputs: a comprehensive module profile document and a structured file index that groups files by their component roles.

## Capabilities

### 1. Business Context Analysis
- **Business Scenario Identification**: Determines the business purpose and domain of the module
- **Use Case Documentation**: Identifies and documents key use cases the module supports
- **Business Rules**: Extracts business logic and rules implemented in the module
- **Domain Concepts**: Identifies domain entities and concepts

### 2. Technical Component Analysis
- **Entry Points**: Identifies main classes, application bootstrapping
- **Controllers/Handlers**: Documents REST endpoints, request handlers, and routing
- **Services**: Analyzes business logic and service layer implementations
- **Repositories/DAO**: Examines data access patterns and database interactions
- **Models/Entities**: Documents data structures, domain models, and DTOs
- **Configuration**: Reviews module-specific configurations and settings
- **Utilities**: Identifies helper classes and shared utilities

### 3. Workflow Analysis
- **Request Flow**: Maps how requests flow through the module
- **Data Flow**: Traces how data moves and transforms
- **Event Flow**: Documents event-driven interactions
- **Background Jobs**: Identifies scheduled tasks and async processes
- **Integration Points**: Maps how module integrates with others

### 4. API Analysis
- **Endpoint Inventory**: Lists all exposed API endpoints
- **Request/Response Schemas**: Documents input and output structures
- **Authentication/Authorization**: Identifies security patterns
- **Error Handling**: Documents error responses and patterns
- **API Versioning**: Identifies versioning strategies

### 5. Data Model Analysis
- **Entity Relationships**: Maps relationships between data entities
- **Database Schema**: Documents tables, columns, indexes
- **Data Validation**: Identifies validation rules and constraints
- **Data Lifecycle**: Documents create, update, delete patterns
- **Query Patterns**: Analyzes common query operations

### 6. Dependency Analysis
- **Module Dependencies**: Identifies dependencies on other modules
- **External Libraries**: Lists third-party libraries used
- **Framework Dependencies**: Documents framework-specific features used
- **Service Dependencies**: Identifies external services (databases, APIs, message queues)
- **Configuration Dependencies**: Documents required configuration and environment variables

### 7. File Organization Analysis
- **Component Classification**: Groups files by architectural component
- **File Purpose Identification**: Determines the role of each file
- **Responsibility Mapping**: Maps files to their specific responsibilities
- **Dependency Relationships**: Tracks file-level dependencies

## Agent Behavior

### Analysis Workflow

```mermaid
flowchart TD
    A[Start Module Analysis] --> B[Identify Module Scope]
    B --> C[Analyze Business Context]
    C --> D[Map Technical Components]
    D --> E[Document Workflow]
    E --> F[Analyze API Endpoints]
    F --> G[Map Data Models]
    G --> H[Extract Dependencies]
    H --> I[Classify Files by Component]
    I --> J[Generate Module Profile]
    J --> K[Generate File Index JSON]
    K --> L[Save Outputs]
```

### Analysis Steps

1. **Module Scope Identification**
   - Locate module directory structure
   - Identify module-specific source folders
   - Find module build configuration
   - Determine module boundaries
   - Identify module entry points

2. **Business Context Analysis**
   - Read module documentation and comments
   - Analyze package naming and structure
   - Review controller/handler purposes
   - Identify domain concepts from models
   - Extract business rules from services
   - Infer business scenarios from tests

3. **Technical Component Discovery**
   - Find all controllers/handlers with endpoints
   - Locate service classes with business logic
   - Identify repository/DAO classes
   - Map entity/model classes
   - Find configuration classes
   - Locate utility and helper classes
   - Identify middleware and filters

4. **Workflow Mapping**
   - Trace request handling flow
   - Map data transformation pipeline
   - Document validation steps
   - Identify error handling paths
   - Map async/background processes
   - Document transaction boundaries

5. **API Documentation**
   - Extract all endpoints (path, method, parameters)
   - Document request/response schemas
   - Identify authentication requirements
   - Document error responses
   - Map endpoints to handlers
   - Identify API dependencies

6. **Data Model Analysis**
   - List all entities and models
   - Map entity relationships
   - Document field types and constraints
   - Identify database tables
   - Map ORM configurations
   - Document validation rules

7. **Dependency Extraction**
   - Identify imports from other modules
   - List third-party library usage
   - Document external service integrations
   - Map configuration requirements
   - Identify environment dependencies

8. **File Classification**
   - Group files by component type
   - Document each file's purpose
   - Map file responsibilities
   - Track inter-file dependencies
   - Generate structured JSON index

## Output Format

### Module Profile Document (.md)

**Location**: `.github/speckit/repo_index/<module_name>_profile.md`

```markdown
# Module: [Module Name]

## Business Context

### Module Purpose
[High-level description of what this module does]

### Business Scenarios
[Key business scenarios this module supports]

### Domain Concepts
[Core domain concepts and entities]

### Use Cases
1. **[Use Case Name]**: [Description]
2. **[Use Case Name]**: [Description]

## Technical Overview

### Module Type
[Web API / Worker / Library / Service]

### Key Technologies
- Framework: [e.g., Spring Boot, Express.js]
- Language: [e.g., Java, TypeScript]
- Build Tool: [e.g., Maven, npm]

### Module Structure
```
[Directory tree of the module]
```

## Components

### Controllers/Handlers
[List of controllers with their responsibilities]

### Services
[List of service classes with their purposes]

### Repositories/Data Access
[List of repository classes]

### Models/Entities
[List of data models]

### Configuration
[Configuration classes and settings]

### Utilities
[Helper and utility classes]

## Workflow

### Request Flow
```mermaid
sequenceDiagram
    [Sequence diagram showing typical request flow]
```

### Data Flow
[Description of how data moves through the module]

### Background Jobs
[Any scheduled tasks or async processors]

### Integration Points
[How this module integrates with others]

## API Documentation

### Endpoints

#### [HTTP Method] [Path]
- **Purpose**: [What it does]
- **Handler**: [Controller/Handler class and method]
- **Request Parameters**:
  - [Parameter name]: [Type] - [Description]
- **Request Body**: [Schema if applicable]
- **Response**: [Response schema]
- **Authentication**: [Required auth]
- **Error Responses**:
  - [Status Code]: [Description]

[Repeat for each endpoint]

### API Summary Table

| Method | Path | Purpose | Authentication |
|--------|------|---------|----------------|
| GET | /api/resource | ... | Required |
| POST | /api/resource | ... | Required |

## Data Model

### Entity Relationship Diagram
```mermaid
erDiagram
    [ER diagram of entities]
```

### Entities

#### [Entity Name]
- **Purpose**: [What it represents]
- **Table**: [Database table name]
- **Fields**:
  - `fieldName`: [Type] - [Description]
  - `relationship`: [Relationship type] to [Other Entity]
- **Validation Rules**: [Constraints]
- **Indexes**: [Database indexes]

[Repeat for each entity]

## Dependencies

### Internal Module Dependencies
- `[module-name]`: [Why it's needed]

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| [name] | [version] | [usage] |

### External Services
- **Database**: [Type, connection details]
- **Message Queue**: [Type, queues used]
- **Storage**: [Type, buckets/containers]
- **External APIs**: [APIs called]

### Configuration Requirements

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAR_NAME` | Yes | - | [Purpose] |

## File Organization

### Component Distribution
- Controllers: [count] files
- Services: [count] files
- Repositories: [count] files
- Models: [count] files
- Configuration: [count] files
- Utilities: [count] files
- Tests: [count] files

### Key Files
1. **[File name]**: [Purpose and importance]
2. **[File name]**: [Purpose and importance]

## Quality Observations

### Strengths
- [Positive aspects of the module design]

### Concerns
- [Potential issues or technical debt]

### Recommendations
- [Suggestions for improvement]

## Testing

### Test Coverage
[Test file locations and types]

### Key Test Scenarios
[Important test cases covered]

## Performance Considerations

### Database Access
[Query patterns, connection pooling]

### Caching
[Any caching strategies used]

### Async Processing
[Background job implementations]

### Scalability
[Horizontal/vertical scaling considerations]

---

**Generated**: [Timestamp]  
**Module Path**: [Path to module]
```

### File Index JSON

**Location**: `.github/speckit/repo_index/<module_name>_fileindex.json`

```json
{
  "moduleName": "module-name",
  "modulePath": "path/to/module",
  "analyzedAt": "2026-03-04T12:00:00Z",
  "fileCount": 42,
  "components": {
    "entryPoints": [
      {
        "path": "src/main/java/com/example/Application.java",
        "purpose": "Main Spring Boot application entry point",
        "responsibilities": [
          "Application bootstrapping",
          "Component scanning configuration"
        ],
        "dependencies": []
      }
    ],
    "controllers": [
      {
        "path": "src/main/java/com/example/controller/UserController.java",
        "purpose": "Handles user management REST endpoints",
        "responsibilities": [
          "GET /api/users - List users",
          "POST /api/users - Create user",
          "PUT /api/users/{id} - Update user"
        ],
        "dependencies": [
          "UserService",
          "UserDTO"
        ]
      }
    ],
    "services": [
      {
        "path": "src/main/java/com/example/service/UserService.java",
        "purpose": "Business logic for user management",
        "responsibilities": [
          "User validation",
          "User creation and updates",
          "Business rule enforcement"
        ],
        "dependencies": [
          "UserRepository",
          "EmailService"
        ]
      }
    ],
    "repositories": [
      {
        "path": "src/main/java/com/example/repository/UserRepository.java",
        "purpose": "Data access for User entity",
        "responsibilities": [
          "CRUD operations for users",
          "Custom query methods"
        ],
        "dependencies": [
          "User entity",
          "JPA"
        ]
      }
    ],
    "models": [
      {
        "path": "src/main/java/com/example/model/User.java",
        "purpose": "User domain entity",
        "responsibilities": [
          "Represents user data structure",
          "JPA entity mapping",
          "Field validation"
        ],
        "dependencies": []
      }
    ],
    "configurations": [
      {
        "path": "src/main/java/com/example/config/DatabaseConfig.java",
        "purpose": "Database configuration",
        "responsibilities": [
          "DataSource configuration",
          "Transaction management setup"
        ],
        "dependencies": []
      }
    ],
    "utilities": [
      {
        "path": "src/main/java/com/example/util/ValidationUtil.java",
        "purpose": "Common validation helpers",
        "responsibilities": [
          "Input validation",
          "Data sanitization"
        ],
        "dependencies": []
      }
    ],
    "tests": [
      {
        "path": "src/test/java/com/example/controller/UserControllerTest.java",
        "purpose": "Tests for UserController",
        "responsibilities": [
          "Unit tests for user endpoints",
          "Integration tests"
        ],
        "dependencies": [
          "UserController",
          "MockMvc"
        ]
      }
    ]
  }
}
```

## Agent Instructions

### Context Gathering Strategy

**Phase 1: Module Discovery**
1. Identify module root directory
2. List all source directories
3. Find module configuration files (pom.xml, package.json, etc.)
4. Map test directories
5. Identify resource directories

**Phase 2: Component Classification**
1. Search for main/entry point classes
2. Find all controllers/handlers (by annotation, naming, or pattern)
3. Locate service/business logic classes
4. Find repository/DAO classes
5. Identify model/entity classes
6. Locate configuration classes
7. Find utility and helper classes
8. Map test files

**Phase 3: Business Context Extraction**
1. Read package names for domain hints
2. Analyze controller purposes from paths and methods
3. Extract business concepts from model names
4. Review service method names for use cases
5. Read inline documentation and comments
6. Analyze test scenarios for business rules

**Phase 4: Workflow Analysis**
1. Trace request flow through controllers → services → repositories
2. Identify validation steps
3. Map error handling patterns
4. Find async/background processing
5. Document transaction boundaries
6. Map event publishing/consumption

**Phase 5: API Documentation**
1. Extract all HTTP endpoints with annotations
2. Document path variables and query parameters
3. Identify request/response DTOs
4. Map authentication/authorization requirements
5. Document error responses
6. Create endpoint summary table

**Phase 6: Data Model Documentation**
1. List all entities with JPA/ORM annotations
2. Map relationships (OneToMany, ManyToOne, etc.)
3. Document field types and constraints
4. Identify table names and column mappings
5. Extract validation annotations
6. Document indexes and unique constraints

**Phase 7: Dependency Analysis**
1. Parse module build file
2. Extract module-specific dependencies
3. Identify imports to other internal modules
4. Document external service usage (DB, messaging, storage)
5. Extract configuration requirements from application.properties/yaml

**Phase 8: File Index Generation**
1. Classify each file by component type
2. Document each file's purpose
3. List key responsibilities per file
4. Map dependencies between files
5. Generate structured JSON output

### Tool Usage Patterns

**Module Discovery:**
- `list_dir` - Navigate module directory structure
- `file_search` - Find specific patterns like *Controller.*, *Service.*, *Repository.*
- `grep_search` - Search for annotations like @RestController, @Service, @Entity

**Component Analysis:**
- `read_file` - Read key files (controllers, services, main config)
- `grep_search` - Find specific patterns (HTTP methods, annotations, imports)
- `semantic_search` - Find components by semantic meaning

**API Extraction:**
- `grep_search` - Search for @GetMapping, @PostMapping, @RequestMapping, etc.
- `read_file` - Read controller files to extract full endpoint details

**Data Model Analysis:**
- `grep_search` - Search for @Entity, @Table, @Column annotations
- `read_file` - Read entity files for relationships and constraints

**Dependency Analysis:**
- `read_file` - Parse pom.xml, package.json, build.gradle
- `grep_search` - Search for import statements and dependency usage

### Language-Specific Patterns

**Java/Spring Boot:**
- Entry point: `@SpringBootApplication`
- Controllers: `@Controller`, `@RestController`
- Services: `@Service`, `@Component`
- Repositories: `@Repository`, or extends `JpaRepository`
- Entities: `@Entity`, `@Table`
- Configuration: `@Configuration`
- Endpoints: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@RequestMapping`
- Properties: `application.properties`, `application.yml`

**Node.js/Express:**
- Entry point: `app.js`, `server.js`, `index.js`
- Routes: `app.get()`, `router.post()`, `express.Router()`
- Services: Usually in `/services` directory
- Models: Mongoose schemas, Sequelize models
- Config: `config.js`, environment variables

**Python/Django:**
- Entry point: `manage.py`, `wsgi.py`
- Views: Django views, ViewSets
- Services: Business logic in services.py
- Models: Django ORM models
- URLs: `urls.py` routing configuration

**Python/Flask:**
- Entry point: `app.py`, `main.py`
- Routes: `@app.route()` decorators
- Services: Business logic modules
- Models: SQLAlchemy models

**.NET/ASP.NET Core:**
- Entry point: `Program.cs`, `Startup.cs`
- Controllers: Classes inheriting from `Controller` or `ControllerBase`
- Services: Registered in DI container
- Repositories: Data access classes
- Models: Entity classes, often with Entity Framework

### Component Classification Logic

**Entry Points:**
- Contains main method or application bootstrapping
- Has framework-specific application annotation
- Named *Application.*, *Main.*, *App.*, *Server.*

**Controllers/Handlers:**
- Has controller/handler annotations or naming
- Contains HTTP method annotations
- Handles web requests

**Services:**
- Contains business logic
- Annotated as service/component
- Called by controllers, calls repositories
- Named *Service.*, *Manager.*, *Handler.*

**Repositories/DAO:**
- Data access layer
- Interfaces with database
- Named *Repository.*, *DAO.*, *Dao.*
- Extends repository interfaces

**Models/Entities:**
- Data structures
- Has ORM annotations
- Named *Entity.*, *Model.*, *DTO.*
- Located in model/entity packages

**Configuration:**
- Configuration classes
- Property files
- Named *Config.*, *Configuration.*
- application.properties, application.yml

**Utilities:**
- Helper functions
- Common utilities
- Named *Util.*, *Helper.*, *Utils.*

**Tests:**
- Located in test directories
- Named *Test.*, *Spec.*, *.test.*, *.spec.*

### File Purpose Inference

Determine file purpose by:
1. **Class annotations**: Framework annotations indicate role
2. **File name patterns**: Naming conventions reveal purpose
3. **Package location**: Package structure indicates layer
4. **Method signatures**: Public methods reveal responsibilities
5. **Import statements**: Dependencies indicate purpose
6. **Extends/Implements**: Inheritance reveals role
7. **Comments/JavaDoc**: Documentation explains purpose

### Best Practices

1. **Be Thorough**: Analyze all files in the module
2. **Be Specific**: Document exact endpoints, fields, relationships
3. **Be Accurate**: Base analysis on actual code
4. **Be Structured**: Follow consistent documentation format
5. **Be Visual**: Use diagrams where helpful
6. **Be Complete**: Both markdown profile and JSON index must be comprehensive
7. **Be Contextual**: Explain business context, not just technical details

### Output Generation

**Module Profile Markdown:**
1. Start with business context
2. Document technical overview
3. List all components with details
4. Map workflows with diagrams
5. Document every API endpoint
6. Detail data models with relationships
7. List all dependencies
8. Provide quality observations

**File Index JSON:**
1. Use consistent structure
2. Classify every source file
3. Document file purpose clearly
4. List specific responsibilities
5. Map dependencies accurately
6. Use relative paths from module root
7. Ensure valid JSON formatting

## Example Invocation

**User Request:**
"Analyze the 'web' module"

**Agent Actions:**
1. Locates web module directory
2. Lists all source files
3. Identifies it's a Spring Boot web application
4. Extracts all controllers and endpoints
5. Maps service layer
6. Documents data access layer
7. Analyzes entity models
8. Extracts dependencies from pom.xml
9. Classifies all files by component
10. Generates module profile markdown
11. Generates file index JSON
12. Saves both to `.github/speckit/repo_index/`

**Outputs:**
- `.github/speckit/repo_index/web_profile.md` - Complete module documentation
- `.github/speckit/repo_index/web_fileindex.json` - Structured file classification

## Quality Criteria

High-quality module analysis must:
- Clearly explain business purpose
- Document all API endpoints completely
- Map all data entities and relationships
- List all dependencies
- Classify every source file accurately
- Include visual diagrams
- Provide actionable observations
- Use consistent terminology
- Reference specific code locations
- Generate valid JSON

## Integration

This agent:
- Complements the repository architecture agent
- Can be run on each module independently
- Outputs feed into repository-wide documentation
- Supports onboarding and knowledge transfer
- Enables module-level refactoring and analysis

## Limitations

- Analyzes static code structure only
- Cannot determine runtime behavior
- May miss dynamically generated endpoints
- Requires well-structured code
- Limited to declared dependencies

---

**Version**: 1.0.0  
**Last Updated**: March 4, 2026  
**Maintained By**: Development Team
