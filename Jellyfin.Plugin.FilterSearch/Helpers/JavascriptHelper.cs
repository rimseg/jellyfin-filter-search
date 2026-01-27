#nullable enable
using System.IO;
using System.Reflection;

namespace Jellyfin.Plugin.FilterSearch.Helpers
{
    /// <summary>
    /// Helper class for building JavaScript injection blocks.
    /// </summary>
    public static class JavascriptHelper
    {
        /// <summary>
        /// Start comment marker for the injected script block.
        /// </summary>
        public static readonly string StartComment = "<!-- BEGIN Filter Search Plugin -->";

        /// <summary>
        /// End comment marker for the injected script block.
        /// </summary>
        public static readonly string EndComment = "<!-- END Filter Search Plugin -->";

        /// <summary>
        /// Builds the injection block containing a loader that fetches the script from the API.
        /// This is a small loader that doesn't require frequent updates to index.html.
        /// </summary>
        /// <returns>The HTML/script block to inject, or empty string if script loading fails.</returns>
        public static string BuildInjectionBlock()
        {
            // Use a small inline loader that fetches the actual script from our API endpoint
            // This way the index.html only needs a small, stable loader
            var timestamp = DateTime.UtcNow.Ticks;
            
            var loaderScript = $@"
(function() {{
    'use strict';
    if (window.filterSearchLoaded) return;
    window.filterSearchLoaded = true;
    
    function loadFilterSearch() {{
        if (window.ApiClient && typeof window.ApiClient.getUrl === 'function') {{
            var script = document.createElement('script');
            script.src = ApiClient.getUrl('FilterSearch/filter-search.js') + '?v={timestamp}';
            script.onerror = function() {{ console.error('Filter Search: Failed to load script'); }};
            document.head.appendChild(script);
        }} else {{
            setTimeout(loadFilterSearch, 100);
        }}
    }}
    
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', loadFilterSearch);
    }} else {{
        loadFilterSearch();
    }}
}})();";

            return $@"{StartComment}
<script>{loaderScript}</script>
{EndComment}";
        }

        /// <summary>
        /// Gets the embedded JavaScript code for the filter search functionality.
        /// </summary>
        /// <returns>The JavaScript code as a string.</returns>
        public static string GetFilterSearchScript()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var resourceName = "Jellyfin.Plugin.FilterSearch.Scripts.filter-search.js";

                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream == null)
                {
                    return string.Empty;
                }

                using var reader = new StreamReader(stream);
                return reader.ReadToEnd();
            }
            catch
            {
                return string.Empty;
            }
        }
    }
}
