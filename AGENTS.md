# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router routes, layouts, and global styles (`globals.css`). Page components should stay close to their route folders.
- `src/context`: Shared React context (e.g., authentication) that can be imported across pages.
- `src/lib`: Client utilities such as Firebase initialization (`firebase.ts`); keep client-only config here.
- `public`: Static assets served at the web root.
- `functions`: Firebase Cloud Functions (Node 18). Builds to `functions/lib`; emulator and deploy settings live in `firebase.json` and `firestore.rules`.
- Root configs: `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, and schema references in `SCHEMA.md`.

## Build, Test, and Development Commands
- Install dependencies: `npm install` (root) and `npm install --prefix functions` for Cloud Functions.
- Run app locally: `npm run dev` (Next.js at `http://localhost:3000`).
- Lint: `npm run lint` (Next.js ESLint with core-web-vitals rules).
- Build: `npm run build`; serve the build with `npm run start`.
- Cloud Functions: `npm run build --prefix functions` to transpile, `npm run serve --prefix functions` to start the functions emulator (requires Firebase CLI).

## Coding Style & Naming Conventions
- Language: TypeScript with functional React components; favor server components unless client interactivity is needed.
- Indentation: 2 spaces; keep imports sorted logically (React/Next, then local).
- File naming: Components in PascalCase (`Component.tsx`); hooks prefixed with `use`; contexts in `src/context`.
- Styling: Tailwind CSS (via Next template); keep class lists readable and colocated with components.
- Run `npm run lint` before pushing; fix autofixable issues via `npx eslint . --fix` if needed.

## Testing Guidelines
- No automated test suite is set up yet. At minimum, run `npm run lint` and `npm run build` before opening a PR.
- If adding tests, prefer `*.test.ts`/`*.test.tsx` colocated near the code or under a `__tests__` folder; keep tests small and focused on behavior, not implementation details.
- Document any manual verification steps (e.g., login flow, Firebase interactions) in the PR description.

## Commit & Pull Request Guidelines
- Commits should be short, imperative summaries (examples in history: “realigning & cleaning up auth + backend”, “redundant comment”); group related changes logically.
- PRs: include a concise description, linked issues, and screenshots or screen recordings for UI changes. Note any config or schema updates (`SCHEMA.md`, Firebase settings) and call out breaking changes.
- Ensure both app and functions build/lint cleanly; mention any follow-up tasks explicitly.

## Environment & Firebase Notes
- Client Firebase config lives in `src/lib/firebase.ts`; avoid committing new secrets—use `.env.local` for overrides and keep keys synced with the Firebase project.
- Cloud Functions target Node 18; use the Firebase CLI for emulation/deploys and keep `firestore.rules`/`firestore.indexes.json` updated when schema changes.
