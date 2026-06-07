# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A **Mac-only, high-performance image & video viewer**. Two modes in one window:
a **virtualized thumbnail grid** (handles thousands of files, cached thumbnails
for fast network browsing) and a **full media viewer** (images + video with
zoom/loop). Built with **Tauri 2** (Rust core + native WebKit UI) and
**TypeScript/Vite**.

## Commands

```sh
npm install            # install frontend deps (once)
npm run tauri dev      # run the app with hot-reload (frontend) + auto-rebuild (Rust)
npm run tauri build    # build a release .app/.dmg → src-tauri/target/release/bundle/macos/
npm run build          # type-check + build the frontend only (fast sanity check)
cargo build            # (from src-tauri/) compile the Rust backend only
```

Rust is installed via rustup; ensure `$HOME/.cargo/bin` is on `PATH`.

## Architecture

```
src/                      Frontend (TypeScript, no framework)
  main.ts                 Entry: toolbar wiring, folder open, startup restore
  ipc.ts                  Typed wrappers over Tauri `invoke` + thumbnail URL memo
  state.ts                App state + sort ordering + shuffled slideshow order
  contextmenu.ts          Minimal right-click menu (Reveal in Finder)
  grid/grid.ts            Virtualized thumbnail grid (DOM cell recycling)
  grid/thumbqueue.ts      Viewport-prioritized thumbnail request scheduler
  grid/typeahead.ts       Finder-style type-to-search
  viewer/viewer.ts        Full media viewer (img/video, loop, shuffle slideshow)
  viewer/zoom.ts          Fit/fill/actual + keyboard zoom + pan math

src-tauri/                Backend (Rust)
  src/main.rs             Tauri setup + #[command] handlers
  src/scan.rs             Non-recursive folder scan, format filter, metadata
  src/thumbs.rs           Thumbnail generation (images in-process; video via qlmanage)
  src/cache.rs            Disk-cache key (path+mtime+size+thumbSize)
  src/settings.rs         Persisted last-folder + recent-folders (settings.json)
  src/model.rs            MediaItem + extension classification
```

### Key flows

- **Scanning:** `scan_folder` returns `MediaItem[]`; sorting/shuffle happen on the
  frontend (`state.ts`) so re-ordering never re-scans.
- **Thumbnails:** the grid only requests thumbs for visible cells. `ThumbScheduler`
  serves them newest-first and *cancels* requests when a cell scrolls out of view,
  so generation always follows the viewport. Images are decoded in-process with the
  `image` crate; video poster frames come from `qlmanage -t`. Every thumb is a small
  JPEG in `~/Library/Caches/com.meandmybadself.imgviewer/thumbnails/`, keyed by
  path+mtime+size so it self-invalidates. The webview loads cached files directly via
  Tauri's asset protocol (`convertFileSrc`) — no base64.
- **Persistence:** `load_settings`/`save_settings` read/write `settings.json` in the
  app config dir; the last folder reopens on launch.

## Conventions

- Frontend is plain TypeScript with strict mode — no framework, no runtime deps
  beyond `@tauri-apps/*`. Keep modules small and single-purpose.
- Rust commands are `async` and offload blocking work via
  `tauri::async_runtime::spawn_blocking`.
- Enabling new Tauri capabilities (asset protocol, plugins) requires matching the
  `Cargo.toml` `tauri` features **and** `tauri.conf.json` / `capabilities/`.

## Gotchas

- The asset protocol needs the `protocol-asset` cargo feature *and*
  `app.security.assetProtocol` in `tauri.conf.json`; its `scope` must cover the
  media path and the cache dir.
- `cargo build | tail` masks cargo's exit code — check for the binary or grep the
  log for `error`, don't trust the pipeline exit status.
- `sample-media/` is gitignored (it includes Apple system `.mov` files used only for
  local testing — do not commit them).

## Releases

Tagged pushes (`v*`) trigger `.github/workflows/release.yml`, which builds the macOS
bundle with `tauri-action` and publishes a GitHub Release. Bump the version in both
`package.json` and `src-tauri/tauri.conf.json`, then `git tag vX.Y.Z && git push --tags`.
