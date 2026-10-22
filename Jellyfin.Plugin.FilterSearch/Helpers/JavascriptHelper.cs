#nullable enable
using System;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace Jellyfin.Plugin.FilterSearch.Helpers
{
    /// <summary>
    /// Helper class for the embedded script and the loader block injected into index.html.
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

        private const string ScriptResourceName = "Jellyfin.Plugin.FilterSearch.Scripts.filter-search.js";

        private static readonly Lazy<byte[]> _scriptBytes = new(LoadScriptBytes);
        private static readonly Lazy<string> _scriptVersion = new(() => ComputeVersion(_scriptBytes.Value));
        private static readonly Lazy<string> _injectionBlock = new(() => CreateInjectionBlock(_scriptVersion.Value));

        /// <summary>
        /// Gets the embedded filter-search.js as UTF-8 bytes (loaded once).
        /// </summary>
        public static byte[] ScriptBytes => _scriptBytes.Value;

        /// <summary>
        /// Gets a short content hash of the embedded script. It only changes when the script changes,
        /// so browsers can cache the script until the plugin is updated.
        /// </summary>
        public static string ScriptVersion => _scriptVersion.Value;

        /// <summary>
        /// Builds the injection block containing a small loader that fetches the script from the API.
        /// </summary>
        /// <returns>The HTML/script block to inject.</returns>
        public static string BuildInjectionBlock() => _injectionBlock.Value;

        /// <summary>
        /// Gets the embedded JavaScript code for the filter search functionality.
        /// </summary>
        /// <returns>The JavaScript code as a string.</returns>
        public static string GetFilterSearchScript() => Encoding.UTF8.GetString(ScriptBytes);

        /// <summary>
        /// Inserts the loader block before the closing body tag.
        /// </summary>
        /// <param name="html">The original index.html content.</param>
        /// <returns>The modified HTML, or <c>null</c> when the block is already present or there is no body tag.</returns>
        public static string? InjectInto(string html)
        {
            if (html.Contains(StartComment, StringComparison.Ordinal))
            {
                return null;
            }

            int bodyIndex = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyIndex < 0)
            {
                return null;
            }

            return string.Concat(html.AsSpan(0, bodyIndex), BuildInjectionBlock(), "\n", html.AsSpan(bodyIndex));
        }

        private static byte[] LoadScriptBytes()
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ScriptResourceName);
            if (stream == null)
            {
                return Array.Empty<byte>();
            }

            using var memory = new MemoryStream();
            stream.CopyTo(memory);
            return memory.ToArray();
        }

        private static string ComputeVersion(byte[] content)
        {
            byte[] hash = SHA256.HashData(content);
            return Convert.ToHexString(hash, 0, 6).ToLowerInvariant();
        }

        private static string CreateInjectionBlock(string version)
        {
            var loaderScript = $@"
(function() {{
    'use strict';
    if (window.filterSearchLoaded) return;
    window.filterSearchLoaded = true;

    function loadFilterSearch() {{
        if (window.ApiClient && typeof window.ApiClient.getUrl === 'function') {{
            var script = document.createElement('script');
            script.src = ApiClient.getUrl('FilterSearch/filter-search.js') + '?v={version}';
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
{EndComment}".Replace("\r\n", "\n", StringComparison.Ordinal);
        }
    }
}
