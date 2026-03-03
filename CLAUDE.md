# Project Context: PixiJS WebGL Browser Game

## Technical Stack
- **Engine:** PixiJS (latest)
- **Language:** TypeScript (Strict mode)
- **Build Tool:** Vite
- **Package Manager:** pnpm
- **Graphics:** SVG & PNG
- **Rendering:** WebGL (Custom shaders/filters preferred for effects)

## Architecture Principles
- **Strict Modularity:** Every game object must be a separate class or module extending `PIXI.Container` or `PIXI.Sprite`.
- **Component-Based:** Use a composition-over-inheritance approach for game logic (e.g., `MovementComponent`, `HealthComponent`).
- **Resource Management:** All assets must be loaded via `PIXI.Assets`. Use a centralized `AssetsManifest`.
- **Decoupled Logic:** Keep game state/logic separate from the PixiJS rendering tree where possible.

## Coding Standards (TypeScript)
- **Type Safety:** No `any`. Use interfaces for component configs and state.
- **Vite Integration:** Use `import.meta.env` for environment variables and asset paths.
- **Module Imports:** Use ESM syntax. Group imports (PixiJS, internal components, types).
- **TSConfig:** Assume `paths` are configured (e.g., `@/components/*`, `@/assets/*`).

## PixiJS Specifics
- **Optimization:** Use `ParticleContainer` for large amounts of similar objects.
- **Cleanup:** Always implement a `destroy()` method in modules to prevent memory leaks (remove listeners, destroy textures).
- **Shaders:** For WebGL effects, use `PIXI.Filter` or `PIXI.Shader`. Keep GLSL code in separate `.frag` or `.vert` strings or files.
- **Resolution:** Support High DPI screens by setting `resolution: window.devicePixelRatio || 1`.

## Graphics Workflow
- **SVG:** Convert to textures at specific scales to maintain sharpness.
- **PNG:** Use for complex textures; optimize for WebGL (power-of-two where applicable).
- **Anchors:** Default to `anchor.set(0.5)` for game objects unless specified otherwise.

## Development Commands
- `pnpm dev` - Start Vite dev server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build