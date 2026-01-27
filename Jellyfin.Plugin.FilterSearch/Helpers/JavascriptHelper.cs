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
        /// Builds the injection block containing the Filter Search script.
        /// </summary>
        /// <returns>The HTML/script block to inject, or empty string if script loading fails.</returns>
        public static string BuildInjectionBlock()
        {
            var script = GetFilterSearchScript();
            if (string.IsNullOrEmpty(script))
            {
                return string.Empty;
            }

            return $@"{StartComment}
<!-- Injected by Filter Search Plugin -->
<script>
{script}
</script>
{EndComment}";
        }

        /// <summary>
        /// Gets the embedded JavaScript code for the filter search functionality.
        /// </summary>
        /// <returns>The JavaScript code as a string.</returns>
        private static string GetFilterSearchScript()
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
