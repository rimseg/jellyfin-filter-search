# Jellyfin Filter Search Plugin

A Jellyfin web client plugin that adds search functionality to filter dialogs (tags, genres, studios, years, etc.) and automatically displays enabled/selected filters at the top of the list.

## Features

- **Search Bar**: Adds a search input to filter sections for quick filtering
- **Selected Items on Top**: Automatically moves enabled/checked filters to the top of the list
- **Real-time Filtering**: Instantly filters items as you type
- **Native Look**: Styled to match Jellyfin's native appearance

## Installation

### Step 1: Copy the plugin file to Jellyfin

**Linux:**
```bash
sudo mkdir -p /usr/share/jellyfin/web/plugins
sudo cp filter-search.js /usr/share/jellyfin/web/plugins/
```

**Windows:**
```powershell
mkdir "C:\Program Files\Jellyfin\Server\jellyfin-web\plugins"
copy filter-search.js "C:\Program Files\Jellyfin\Server\jellyfin-web\plugins\"
```

### Step 2: Add the script to index.html

Edit the `index.html` file in Jellyfin's web directory and add this line before `</body>`:

```html
<script src="plugins/filter-search.js"></script>
```

**Linux (one-liner):**
```bash
sudo sed -i 's|</body>|<script src="plugins/filter-search.js"></script>\n</body>|' /usr/share/jellyfin/web/index.html
```

### Step 3: Clear browser cache

Hard refresh your browser (Ctrl+Shift+R) or clear the cache completely.

---

## Usage

1. Go to any library (Movies, TV Shows, etc.)
2. Click the **Filter** button
3. Expand a filter section (Tags, Genres, Studios, etc.)
4. A search bar will appear at the top of the section
5. Selected filters are automatically shown at the top with a "Selected" label

---

## Uninstallation

1. Remove the script tag from `index.html`:
   ```bash
   sudo sed -i '/filter-search.js/d' /usr/share/jellyfin/web/index.html
   ```

2. Delete the plugin file:
   ```bash
   sudo rm /usr/share/jellyfin/web/plugins/filter-search.js
   ```

3. Clear browser cache

---

## Notes

- The search bar only appears in sections with 5+ items
- Updates to Jellyfin may overwrite `index.html`, requiring re-adding the script tag
- Works with Jellyfin 10.8.x and later

---

## License

MIT License
