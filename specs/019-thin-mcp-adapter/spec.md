# Feature Specification: Thin MCP Adapter

**Feature Branch**: `019-thin-mcp-adapter`  
**Created**: 2026-05-16  
**Status**: Draft  
**Dependency Note**: Build after `014-management-api-truth`, and keep alignment with `013-agent-first-control-plane`, `016-agent-runtime-skills`, and `017-operator-cli-surface`. Reuse the existing MCP route from `007-mcp-server`, but treat it strictly as a transport adapter over the canonical management contract rather than as an independent product surface.
**Input**: User description: "Mystra should keep MCP as a thin adapter. HTTP API is product truth, the skill surface is the current typed agent-facing layer, CLI is the operator surface, and MCP should translate transport concerns without owning a competing business contract."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coordinating Agent Uses MCP Without Seeing A Second Truth (Priority: P1)

As a coordinating agent using MCP tools, I want project inspection, job
submission, polling, and cancelation to mean the same thing they mean in the
canonical management API, so that I do not have to learn a second Mystra
contract just because the transport is JSON-RPC.

**Why this priority**: MCP is already an active integration path. If it drifts
from the canonical management surface, every agent integration inherits hidden
translation bugs.

**Independent Test**: Use the MCP tools for project inspection, job submission,
job polling, and job cancelation, then confirm the returned payloads and
business failures match the canonical management semantics.

**Acceptance Scenarios**:

1. **Given** the coordinating agent lists projects or reads a job through MCP,
   **When** the adapter returns a payload, **Then** the business fields match the
   canonical management contract rather than a tool-local reinterpretation.
2. **Given** a business failure such as missing project or missing job occurs,
   **When** the MCP adapter responds, **Then** it reuses the shared
   machine-readable management error vocabulary instead of inventing a second one.

---

### User Story 2 - Operator And Maintainer Evolve One Canonical Management Contract (Priority: P1)

As a maintainer of Mystra, I want MCP to remain a thin transport layer over the
same management contract used by API, skill, and CLI surfaces, so that new
capabilities or fixes do not require parallel contract work in every transport.

**Why this priority**: The whole point of the agent-first control-plane direction
is to have one truth. If MCP owns separate semantics, every later surface pays
that drift tax forever.

**Independent Test**: Review the implementation of at least one project action
and one job action, and confirm the MCP path adapts shared schemas and canonical
payloads instead of re-implementing business logic.

**Acceptance Scenarios**:

1. **Given** the canonical management contract changes additively, **When** MCP
   is updated, **Then** the adapter only needs transport-focused changes rather
   than a second business-schema redesign.
2. **Given** a maintainer reads the MCP implementation, **When** they trace a
   tool call, **Then** it is clear which parts are transport concerns and which
   parts are canonical management semantics.

---

### User Story 3 - Transport Errors Stay Transport-Specific While Business Errors Stay Canonical (Priority: P2)

As an agent integrator, I want invalid params and JSON-RPC transport failures to
remain transport-specific while business failures still use Mystra's canonical
error vocabulary, so that retry, debugging, and operator reasoning stay clear.

**Why this priority**: MCP has a real transport contract. Pretending transport
and business failures are the same thing creates ambiguous client behavior.

**Independent Test**: Trigger both an invalid MCP tool call and a valid tool call
that hits a business failure, then confirm the adapter returns transport errors
for the first and canonical management errors for the second.

**Acceptance Scenarios**:

1. **Given** the client sends invalid tool arguments, **When** MCP validation
   fails, **Then** the response uses transport-level JSON-RPC error semantics.
2. **Given** the tool arguments are valid but the requested project or job does
   not exist, **When** the canonical management action fails, **Then** the
   adapter returns the shared business error vocabulary inside the MCP result.

---

### Edge Cases

- What happens when the canonical management API evolves but MCP is not updated?
  The feature should be considered incomplete because it would reintroduce a
  second truth.
- What happens when a tool call is transport-valid but maps to a missing
  canonical action? The adapter should fail clearly instead of silently
  synthesizing partial behavior.
- What happens when MCP payload transport remains text-wrapped for compatibility?
  The payload meaning should still remain canonical even if the transport wrapper
  does not change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST treat the canonical management API as the product
  truth for all business semantics exposed through MCP.
- **FR-002**: MCP tool outputs for project inspection, job submission, polling,
  list, and cancel actions MUST reuse the canonical management payload meanings.
- **FR-003**: Business failures exposed through MCP MUST reuse the shared
  machine-readable management error vocabulary.
- **FR-004**: MCP transport failures such as invalid params, unknown method, or
  malformed JSON-RPC requests MUST remain transport-specific and MUST NOT be
  rewritten as business errors.
- **FR-005**: The MCP adapter MUST avoid owning a second copy of project/job/run
  business logic when the canonical management contract already defines it.
- **FR-006**: The feature MUST preserve a clear separation between transport
  adaptation concerns and business-contract ownership in review and
  implementation.
- **FR-007**: New management capabilities introduced after `014` MUST not be
  considered complete in MCP unless they remain derivable from the canonical
  management contract instead of route-local tool semantics.

### Key Entities *(include if feature involves data)*

- **ThinMcpAdapter**: The MCP transport layer that translates tool calls to and
  from the canonical management contract without becoming the contract owner.
- **CanonicalManagementContract**: The business truth for project inspection, job
  submission, job observation, cancelation, and related management actions.
- **TransportError**: MCP- or JSON-RPC-specific validation and invocation
  failures.
- **ManagementError**: Shared business failure vocabulary reused from the
  canonical management contract.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For core management actions, MCP payloads and business failures can
  be shown to match the canonical management contract without transport-specific
  reinterpretation.
- **SC-002**: Invalid MCP requests remain clearly transport-specific, while valid
  business failures remain clearly canonical.
- **SC-003**: Maintainers can add or evolve a canonical management capability
  without having to design a second MCP-only business contract.
