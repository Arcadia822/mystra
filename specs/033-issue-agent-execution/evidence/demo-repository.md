# Private Demo Repository Evidence

Date: 2026-07-23

- Repository: `Arcadia822/mystra-agent-demo-033`
- URL: https://github.com/Arcadia822/mystra-agent-demo-033
- Visibility: private
- Default branch: `main`
- Baseline commit: `0f77e79c0494555399110d8714ae4cb9184fe748`
- Runtime: dependency-free Node.js 24 web demo
- Quality commands: `npm test`, `npm run build`
- Preview command: `npm run preview -- --host 0.0.0.0 --port 3000`

The baseline deliberately contains two failing tests for STU-55. It has no GitLab
remote, Castrel source, stored credential, generated dependency directory or secret
file.
