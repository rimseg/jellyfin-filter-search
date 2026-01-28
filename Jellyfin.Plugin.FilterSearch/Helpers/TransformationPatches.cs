#nullable enable
using Jellyfin.Plugin.FilterSearch.Model;

namespace Jellyfin.Plugin.FilterSearch.Helpers
{
    /// <summary>
    /// Provides transformation patches for the File Transformation plugin.
    /// </summary>
    public static class TransformationPatches
    {
        /// <summary>
        /// Patches index.html to inject the Filter Search script.
        /// This method is called by the File Transformation plugin.
        /// </summary>
        /// <param name="content">The payload containing the file contents.</param>
        /// <returns>The modified file contents with the script injected.</returns>
        public static string IndexHtml(PatchRequestPayload content)
        {
            if (string.IsNullOrEmpty(content.Contents))
            {
                return content.Contents ?? string.Empty;
            }

            var injectionBlock = JavascriptHelper.BuildInjectionBlock();

            if (string.IsNullOrEmpty(injectionBlock))
            {
                return content.Contents;
            }

            if (content.Contents.Contains("</body>"))
            {
                return content.Contents.Replace("</body>", $"{injectionBlock}\n</body>");
            }

            return content.Contents;
        }
    }
}
