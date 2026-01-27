using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.FilterSearch.Configuration
{
    /// <summary>
    /// Configuration class for the Filter Search plugin.
    /// </summary>
    public class PluginConfiguration : BasePluginConfiguration
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
        /// </summary>
        public PluginConfiguration()
        {
            Enabled = true;
        }

        /// <summary>
        /// Gets or sets a value indicating whether the filter search is enabled.
        /// </summary>
        public bool Enabled { get; set; }
    }
}
