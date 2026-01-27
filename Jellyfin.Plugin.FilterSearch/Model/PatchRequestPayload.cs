#nullable enable
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.FilterSearch.Model
{
    /// <summary>
    /// Payload model for the File Transformation plugin patch requests.
    /// </summary>
    public class PatchRequestPayload
    {
        /// <summary>
        /// Gets or sets the file contents to be transformed.
        /// </summary>
        [JsonPropertyName("contents")]
        public string? Contents { get; set; }
    }
}
