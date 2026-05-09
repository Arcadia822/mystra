# Mystra Scripts

`submit-job.mjs` is the primary local job submission helper. It resolves a Project
by slug and posts a job with `projectId` so callers do not repeat repository,
base branch, agent, or image defaults.

`prewarm-project.sh` is a manual cache preparation helper. Automatic prewarm is a
future sandbox-provider capability; the current bare Docker runner only consumes
the Project image returned by the claim API.
