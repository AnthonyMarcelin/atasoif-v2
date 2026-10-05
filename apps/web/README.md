# Web

Angular 20 app for À ta soif (cave SPA → **Capacitor iOS/Android stores**, not a Dokploy `app.` subdomain). Prefer repo-root scripts (`bun run dev:web`). Package manager: **Bun** (see [`docs/BUN.md`](../../docs/BUN.md)).

| | |
| --- | --- |
| Bundle ID | `fr.atasoif.app` |
| Capacitor config | [`capacitor.config.ts`](./capacitor.config.ts) |
| iOS project | [`ios/App/App.xcodeproj`](./ios/App/App.xcodeproj) |
| Prod API | `https://api.atasoif.fr` (`src/environments/environment.ts`) |
| TestFlight runbook | [`docs/CAPACITOR-IOS-TESTFLIGHT.md`](../../docs/CAPACITOR-IOS-TESTFLIGHT.md) |

### Capacitor iOS (local)

```bash
# From monorepo root
bun run ios:sync    # production web build + cap sync ios
bun run ios:open    # open Xcode

# From this package
bun run ios:sync
bun run ios:open
```

Archive / TestFlight upload is **manual in Xcode** (Anthony: Team `D3UKXNVT3D`, signing, App Store Connect). Do not commit certs or provisioning profiles.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.32.

## Development server

To start a local development server, run:

```bash
bun run start
# from monorepo root: bun run dev:web
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## API base URL

| Configuration | File | `apiBaseUrl` |
|---|---|---|
| Production (`ng build` / default) | `src/environments/environment.ts` | `https://api.atasoif.fr` |
| Development (`ng serve`) | `src/environments/environment.development.ts` | `http://localhost:3000` |

`angular.json` swaps the development file via `fileReplacements`. Relative media paths (`/api/v1/media/off/…`) are resolved against `apiBaseUrl` in `BottlePhoto`.

Prod hosting (Dokploy) is **not** wired yet — see [`docs/DOKPLOY-WEB.md`](../../docs/DOKPLOY-WEB.md).

## Building

From monorepo root (preferred):

```bash
bun run build:shared && bun run build:web
```

Or inside this package:

```bash
bun run build
```

Artifacts land under `dist/web`. The production build embeds `https://api.atasoif.fr` as the API origin.


## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
