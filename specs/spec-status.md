# Spec-Driven Development Status
<!-- spec-status: project=mystra commit=ebf5ed7ef1cca4f72e0bddb1f2736b3ba6dbb771 updated=2026-08-05T02:30:33Z -->

## Current business-model authority

`038-task-session-model` supersedes the active business-contract portions of
001, 003, 007, 008, 014, 017, 018, 019, 033, and 035. Those completed feature
directories remain immutable implementation history; their superseded
terminology is not a current contract and is deliberately excluded from the
active audit. Feature 025 has been updated in place because it is still an
unimplemented active UI specification.

The current model is Task intent, zero or more independently created Sessions,
and stable Runners. Internal execution facts are transport/persistence details;
public activity timeline and event-collection contracts remain deferred.

| Feature                            | Specify | Plan | Tasks | Implement |
|------------------------------------|---------|------|-------|-----------|
| 001-project-and-sqlite             | ✓     | ✓  | ✓   | ✓ Complete |
| 002-runtime-profile-context        | ✓     | ✓  | ✓   | ✓ Complete |
| 003-config-first-runner-durability | ✓     | ✓  | ✓   | ✓ Complete |
| 004-open-agents-framework          | ✓     | ✓  | ✓   | ✓ Complete |
| 005-workflow-blueprint             | ✓     | ✓  | ✓   | ✓ Complete |
| 006-control-plane-ui               | ✓     | ✓  | ✓   | ✓ Complete |
| 007-mcp-server                     | ✓     | ✓  | ✓   | ✓ Complete |
| 008-mcp-skills                     | ✓     | ✓  | ✓   | ✓ Complete |
| 009-agent-adapters                 | ✓     | ✓  | ✓   | ✓ Complete |
| 010-repo-provider-contracts        | ✓     | ✓  | ✓   | ✓ Complete |
| 011-docker-sandbox-provider        | ✓     | ✓  | ✓   | ✓ Complete |
| 012-github-repo-provider-parity    | ✓     | ✓  | ✓   | ✓ Complete |
| 013-agent-first-control-plane      | ✓     | ✓  | ✓   | ✓ Complete |
| 014-management-api-truth           | ✓     | ✓  | ✓   | ✓ Complete |
| 015-multi-project-lanes            | ✓     | ✓  | ✓   | ✓ Complete |
| 016-agent-runtime-skills           | ✓     | ✓  | ✓   | ✓ Complete |
| 017-operator-cli-surface           | ✓     | ✓  | ✓   | ✓ Complete |
| 018-coordination-run-summaries     | ✓     | ✓  | ✓   | ✓ Complete |
| 019-thin-mcp-adapter               | ✓     | ✓  | ✓   | ✓ Complete |
| 020-layered-context-harness        | ✓     | ✓  | ✓   | ✓ Complete |
| 021-product-surface-positioning    | ✓     | ✓  | ✓   | ✓ Complete |
| 022-lsp-navigation                 | ✓     | ✓  | ✓   | ✓ Complete |
| 023-control-plane-design-system    | ✓     | ✓  | ✓   | ✓ Complete |
| 024-agent-runtime-sdk              | ✓     | ✓  | ✓   | ✓ Complete |
| 025-webui                          | ✓     | ✓  | ✓   | ● 0/27 (0%) |
| 033-issue-agent-execution          | ✓     | ✓  | ✓   | ✓ Complete |
| 035-control-plane-object-pages     | ✓     | ✓  | ✓   | ✓ Complete |
| 036-project-object-pages           | ✓     | ✓  | ✓   | ✓ Complete |
| 037-remote-repository-integrations | ✓     | ✓  | ✓   | ✓ Complete |
| 038-task-session-model             | ✓     | ✓  | ✓   | ✓ Complete |

<!-- feature: 001-project-and-sqlite has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=68 tasks_completed=68 checklist_files=requirements.md -->
<!-- feature: 002-runtime-profile-context has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=73 tasks_completed=73 checklist_files=requirements.md,runtime-contract.md -->
<!-- feature: 003-config-first-runner-durability has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=50 tasks_completed=50 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 004-open-agents-framework has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=23 tasks_completed=23 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 005-workflow-blueprint has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=false tasks_total=14 tasks_completed=14 checklist_files= -->
<!-- feature: 006-control-plane-ui has_spec=true has_plan=true has_tasks=true has_research=false has_data_model=false has_quickstart=false has_contracts=false has_checklists=false tasks_total=9 tasks_completed=9 checklist_files= -->
<!-- feature: 007-mcp-server has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=false tasks_total=12 tasks_completed=12 checklist_files= -->
<!-- feature: 008-mcp-skills has_spec=true has_plan=true has_tasks=true has_research=false has_data_model=false has_quickstart=true has_contracts=false has_checklists=false tasks_total=11 tasks_completed=11 checklist_files= -->
<!-- feature: 009-agent-adapters has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=false tasks_total=20 tasks_completed=20 checklist_files= -->
<!-- feature: 010-repo-provider-contracts has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=32 tasks_completed=32 checklist_files=requirements.md -->
<!-- feature: 011-docker-sandbox-provider has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=35 tasks_completed=35 checklist_files=requirements.md -->
<!-- feature: 012-github-repo-provider-parity has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=23 tasks_completed=23 checklist_files=requirements.md -->
<!-- feature: 013-agent-first-control-plane has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=8 tasks_completed=8 checklist_files=requirements.md -->
<!-- feature: 014-management-api-truth has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=29 tasks_completed=29 checklist_files=requirements.md -->
<!-- feature: 015-multi-project-lanes has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=26 tasks_completed=26 checklist_files=requirements.md -->
<!-- feature: 016-agent-runtime-skills has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=16 tasks_completed=16 checklist_files=requirements.md -->
<!-- feature: 017-operator-cli-surface has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=18 tasks_completed=18 checklist_files=requirements.md -->
<!-- feature: 018-coordination-run-summaries has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=9 tasks_completed=9 checklist_files=requirements.md -->
<!-- feature: 019-thin-mcp-adapter has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=false tasks_total=6 tasks_completed=6 checklist_files= -->
<!-- feature: 020-layered-context-harness has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=10 tasks_completed=10 checklist_files=requirements.md -->
<!-- feature: 021-product-surface-positioning has_spec=true has_plan=true has_tasks=true has_research=false has_data_model=false has_quickstart=false has_contracts=false has_checklists=true tasks_total=6 tasks_completed=6 checklist_files=requirements.md -->
<!-- feature: 022-lsp-navigation has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=12 tasks_completed=12 checklist_files=requirements.md -->
<!-- feature: 023-control-plane-design-system has_spec=true has_plan=true has_tasks=true has_research=false has_data_model=false has_quickstart=false has_contracts=false has_checklists=false tasks_total=12 tasks_completed=12 checklist_files= -->
<!-- feature: 024-agent-runtime-sdk has_spec=true has_plan=true has_tasks=true has_research=false has_data_model=false has_quickstart=false has_contracts=false has_checklists=true tasks_total=3 tasks_completed=3 checklist_files=requirements.md -->
<!-- feature: 025-webui has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=27 tasks_completed=0 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 033-issue-agent-execution has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=61 tasks_completed=61 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 035-control-plane-object-pages has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=20 tasks_completed=20 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 036-project-object-pages has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=11 tasks_completed=11 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 037-remote-repository-integrations has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=34 tasks_completed=34 checklist_files=engineering-review.md,requirements.md -->
<!-- feature: 038-task-session-model has_spec=true has_plan=true has_tasks=true has_research=true has_data_model=true has_quickstart=true has_contracts=true has_checklists=true tasks_total=67 tasks_completed=67 checklist_files=engineering-review.md,implementation-impact.md,requirements.md,verification.md -->
