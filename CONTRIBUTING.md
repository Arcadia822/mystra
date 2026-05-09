# Contributing to Mystra

## Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## Pull Requests

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make your change. Run `pnpm typecheck && pnpm test` before pushing.
4. Open a pull request with a clear description of the change and motivation.

## Code Style

- TypeScript strict mode. Zod schemas at service boundaries.
- No comments unless requested.
- Follow existing patterns in the codebase.

## Scope

Do not introduce MVP-excluded features (see [PRODUCT.md](PRODUCT.md)) without an explicit product-boundary update first.
