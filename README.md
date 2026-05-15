# Dripstone

A static JSON data API serving Minecraft reference data, primarily used by [mDirt](https://github.com/JoelDaDev/mDirt). Hosted as a GitHub Pages site with a built-in terminal-style data browser.

## API

All data is served as static JSON files. Fetch them directly by path:

| File | Path | Description |
|------|------|-------------|
| Index | `data/index.json` | Manifest of all available data files |
| Version List | `data/version_list.json` | Supported Minecraft versions with format numbers |
| 26.1 Data | `data/26.1_data.json` | Blocks, items, and more for Minecraft 26.1 |
| 26.2 Data | `data/26.2_data.json` | Blocks, items, and more for Minecraft 26.2 |

### Usage

Deep-linking to a specific file via the browser: append `#data/<file>.json` to the URL.

## Data Browser

The repo includes a terminal-style web UI (`index.html`) for browsing and inspecting the JSON files. It supports collapsible tree view, search/filter, and one-click copy of URLs or raw JSON.

