# Img Viewer

A Mac-only, high-performance image & video viewer built with **Tauri 2** (Rust core + native WebKit UI) and **TypeScript**.

## Features

**Thumbnail grid**
- Virtualized — only on-screen cells exist in the DOM, so it stays smooth with thousands of files.
- Local thumbnail cache (`~/Library/Caches/com.meandmybadself.imgviewer/thumbnails/`) keyed by path + mtime + size, so re-browsing a network share is instant.
- **Scroll-aware loading** — thumbnail generation follows the viewport: scroll fast and it abandons work for cells you flew past and prioritizes where you landed.
- Sort by **name** or **modified**, ascending/descending.
- **Shuffle** mode.
- Finder-style **type-to-search**: just start typing a filename to jump to it.
- Adjustable thumbnail size.
- **Remembers** the last folder (reopens on launch) and keeps a **recent folders** menu.

**Media viewer**
- Images: jpg, png, gif, webp (gif/webp animate). Videos: mov, mp4, m4v.
- Video **loop** toggle, play/pause.
- Keyboard **zoom**, **zoom-to-fit**, **zoom-to-fill**, actual size; drag to pan.

## Keyboard

**Grid:** arrows = move · `Home`/`End` = first/last · `Enter` = open · type = search · `⌘ +`/`⌘ -` = thumbnail size

**Viewer:** `Esc` = back · `←`/`→` = prev/next · `+`/`-` = zoom · `0` = fit · `9` = fill · `1` = actual · `L` = loop · `Space` = play/pause

## Develop

```sh
npm install
npm run tauri dev     # launches the app with hot-reload
```

## Install

Grab the latest `.dmg`/`.app` from the [Releases](../../releases) page.
The app is **unsigned**, so on first launch right-click it → **Open**, or run:

```sh
xattr -dr com.apple.quarantine /Applications/ImgViewer.app
```

## Build a release `.app` locally

```sh
npm run tauri build
```

The bundled app lands in `src-tauri/target/release/bundle/macos/`.

## Releases (CI)

Pushing a tag that starts with `v` triggers `.github/workflows/release.yml`, which
builds the macOS bundle on a GitHub runner and publishes a Release with the artifacts.

```sh
# bump version in package.json AND src-tauri/tauri.conf.json first
git tag v0.1.0
git push origin v0.1.0
```

You can also run the workflow manually from the **Actions** tab (`workflow_dispatch`).

## How thumbnails work

The Rust backend decodes **images** in-process (the `image` crate) and downscales them on a blocking thread pool. **Video** poster frames come from macOS Quick Look (`qlmanage`), which natively understands mov/mp4. Every thumbnail is normalized to a small JPEG and written to the on-disk cache; the WebView loads cached files directly via Tauri's asset protocol (no base64 overhead).
