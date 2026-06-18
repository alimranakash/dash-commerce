# Dash Commerce OS

Dash Commerce OS is a production-grade multi-tenant SaaS commerce platform. This repository starts with a clean Turborepo foundation for a scalable Next.js and TypeScript codebase.

## Monorepo Structure

- `apps/web` - Main Next.js App Router application. It will later serve the marketing site, seller dashboard, and tenant storefronts.
- `apps/worker` - TypeScript Node worker placeholder for future background jobs.
- `packages/db` - Placeholder for the future Prisma/PostgreSQL package.
- `packages/ui` - Shared React UI primitives.
- `packages/config` - Shared TypeScript and ESLint configuration.
- `packages/types` - Shared TypeScript domain types.
- `packages/storeos-sdk` - Placeholder for the future StoreOS API SDK.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Build all apps and packages:

```bash
npm run build
```

Run linting and type checks:

```bash
npm run lint
npm run typecheck
```

Copy `.env.example` to `.env.local` when local environment values are needed. Auth, database, products, orders, payments, and StoreOS integration are intentionally not implemented yet.
