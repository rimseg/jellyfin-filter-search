<p align="center">
  <img src="docs/icon-cutout.png" alt="Filter Search Plugin" width="300" height="300">
</p>

<h1 align="center">Jellyfin Filter Search Plugin</h1>

<p align="center">
  A Jellyfin plugin that adds search functionality to filter dialogs and displays enabled filters at the top.
</p>

<p align="center">
  <a href="https://jellyfin-filtersearch.rimsg.com/"><strong>Website</strong></a> ·
  <a href="#installation">Installation</a> ·
  <a href="#compatibility">Compatibility</a>
</p>

<p align="center">
  <img src="docs/demo-modern.gif" alt="Filter Search in the Jellyfin 12 modern layout" width="800">
</p>

---

## ✅ No extra setup (since 2.0)

Since version **2.0.0.0** the plugin adds its script to the Jellyfin web client **in memory**, while Jellyfin serves the page. It never adds anything to `index.html` on disk, so:

- no `chown` of `index.html`, and nothing to redo after Jellyfin updates
- no [File Transformation plugin](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) needed on Docker (if you already have it installed, both work side by side)
- native Linux, Docker and Windows installs all work the same way

> **Upgrading from 1.x?** 2.0 never adds anything to `index.html` on disk. On first start it removes the script block that 1.x wrote there, if the file is writable; if it is read-only, the old block stays and is harmless (the script still loads only once). You can revert an earlier `chown`. If you mounted a copy of `index.html` as a Docker volume for 1.x, **remove that mount**: the copy goes stale with every Jellyfin update. Filter Search no longer needs File Transformation; keep it if other plugins use it.

---

## Features

- **Search through filter options** – Quickly find tags, genres, studios, years, and more
- **Selected filters at top** – Enabled/checked filters are automatically shown at the top
- **Select All / None** – Check or uncheck every option that matches the current search in one click
- **Sticky search bar** – The search input stays visible while scrolling
- **Modern and Legacy layouts** – Works in the Jellyfin 12 modern web UI and in the "Legacy Desktop" display mode
- **Big libraries** – Tested with 3,000 tags: searching stays well under a tenth of a second, long tag names wrap cleanly
- **No extra setup** – No file permissions to change and no second plugin required

## Compatibility

| Jellyfin version | Plugin version | Layouts |
|------------------|----------------|---------|
| 12.2.x           | 2.0.0.0        | Modern and Legacy |
| 10.11.8 and newer | 1.8.0.0      | Legacy |
| 10.11.0 – 10.11.7, 10.10.7 | 1.7.0.0 | Legacy |

## Demo

**Modern layout (Jellyfin 12 default)**

![Filter Search in the modern layout](docs/demo-modern.gif)

**Legacy Desktop layout**

![Filter Search in the legacy layout](docs/demo-legacy.gif)

## Installation

1. Go to **Dashboard** → **Plugins** → **Repositories**
2. Add the Filter Search repository:
   ```
   https://raw.githubusercontent.com/rimseg/jellyfin-filter-search/main/manifest.json
   ```
3. Go to **Catalog** and install **Filter Search**
4. Restart Jellyfin

## Configuration

After installation, go to **Dashboard** → **Plugins** → **Filter Search** to enable/disable the plugin.

## Usage

1. Go to any library (Movies, TV Shows, etc.)
2. Click the **Filter** button (the funnel icon in the library toolbar)
3. Expand a filter section (Tags, Genres, Studios, etc.)
4. A search bar will appear at the top of the section (for sections with 5 or more options)
5. Selected filters are automatically shown at the top with a "Selected" label
6. Use **Select All** / **None** to toggle every option that matches the current search

## Building from Source

### Prerequisites

- .NET 10 SDK (for Jellyfin 12.x), .NET 9 SDK (for Jellyfin 10.11.x) or .NET 8 SDK (for Jellyfin 10.10.x)

### Build

```bash
cd Jellyfin.Plugin.FilterSearch
dotnet build -c Release
```

The built plugin will be in `bin/Release/net10.0/` (or `net9.0` / `net8.0` for older Jellyfin versions).

### Install Manually

Installing from the plugin catalog is easiest. To install a build by hand:

1. **Remove any installed version first.** Uninstall Filter Search under **Dashboard → Plugins** and restart, or stop Jellyfin and delete the existing `Filter Search_<version>` folder. If an old version stays next to the new one, Jellyfin loads both.
2. Stop Jellyfin.
3. Create the folder `Filter Search_2.0.0.0` in your Jellyfin plugins directory and copy `Jellyfin.Plugin.FilterSearch.dll` into it:
   - **Linux (Debian/Ubuntu packages):** `/var/lib/jellyfin/plugins/`
   - **Linux (other):** `~/.local/share/jellyfin/plugins/`
   - **Windows:** `C:\ProgramData\Jellyfin\Server\plugins\`
   - **Docker:** `/config/plugins/` (linuxserver.io images: `/config/data/plugins/`)
4. Make sure the folder is readable by the user Jellyfin runs as (on Linux: `sudo chown -R jellyfin:jellyfin "/var/lib/jellyfin/plugins/Filter Search_2.0.0.0"`).
5. Start Jellyfin. **Dashboard → Plugins** should list Filter Search 2.0.0.0.

### Building for Different Jellyfin Versions

Edit the `JellyfinVersion` property in `Jellyfin.Plugin.FilterSearch.csproj`:

```xml
<!-- For Jellyfin 10.10.x -->
<JellyfinVersion>10.10.7</JellyfinVersion>

<!-- For Jellyfin 10.11.x -->
<JellyfinVersion>10.11.8</JellyfinVersion>

<!-- For Jellyfin 12.x -->
<JellyfinVersion>12.2.0</JellyfinVersion>
```

## Notes

- Version 2.0.0.0 targets Jellyfin 12.2 and supports both the modern layout and the "Legacy Desktop" display mode
- The script is added to the web client by an ASP.NET Core `IStartupFilter` middleware, so nothing is added to `index.html` on disk
- Search, Select All / None and the "Selected" group appear in filter sections with five or more options
- For Jellyfin 10.10.7 and 10.11.x use the older releases listed under [Compatibility](#compatibility)

## Credits

- [Jellyfin-Javascript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector/)

## License

[MIT](LICENSE)