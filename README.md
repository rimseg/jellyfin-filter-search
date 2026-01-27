<p align="center">
  <img src="icon.png" alt="Filter Search Plugin" width="128" height="128">
</p>

<h1 align="center">Jellyfin Filter Search Plugin</h1>

<p align="center">
  A Jellyfin plugin that adds search functionality to filter dialogs and displays enabled filters at the top.
</p>

## Features

- **Search through filter options** – Quickly find tags, genres, studios, years, and more
- **Selected filters at top** – Enabled/checked filters are automatically shown at the top
- **Sticky search bar** – The search input stays visible while scrolling
- **Works everywhere** – Compatible with all Jellyfin filter dialogs

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
2. Click the **Filter** button
3. Expand a filter section (Tags, Genres, Studios, etc.)
4. A search bar will appear at the top of the section
5. Selected filters are automatically shown at the top with a "Selected" label

## Building from Source

### Prerequisites

- .NET 8 SDK (for Jellyfin 10.10.x) or .NET 9 SDK (for Jellyfin 10.11.x)

### Build

```bash
cd Jellyfin.Plugin.FilterSearch
dotnet build -c Release
```

The built plugin will be in `bin/Release/net8.0/`.

### Install Manually

Copy `Jellyfin.Plugin.FilterSearch.dll` to your Jellyfin plugins directory:
- **Linux:** `~/.local/share/jellyfin/plugins/FilterSearch/`
- **Windows:** `%APPDATA%\Jellyfin\Server\plugins\FilterSearch\`
- **Docker:** `/config/plugins/FilterSearch/`

Then restart Jellyfin.

### Building for Different Jellyfin Versions

Edit the `JellyfinVersion` property in `Jellyfin.Plugin.FilterSearch.csproj`:

```xml
<!-- For Jellyfin 10.10.x -->
<JellyfinVersion>10.10.7</JellyfinVersion>

<!-- For Jellyfin 10.11.x -->
<JellyfinVersion>10.11.0</JellyfinVersion>
```

## Notes

- The search bar only appears in sections with 5+ items
- Works with Jellyfin 10.10.x and later

## License

MIT License
