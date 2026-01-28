#nullable enable
using System;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.FilterSearch.Configuration;
using Jellyfin.Plugin.FilterSearch.Helpers;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.FilterSearch
{
    /// <summary>
    /// Filter Search Plugin for Jellyfin.
    /// Adds search functionality to filter dialogs (tags, genres, studios, etc.)
    /// and displays enabled/checked filters at the top of the list.
    /// </summary>
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        private readonly IApplicationPaths _appPaths;
        private readonly ILogger<Plugin> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="Plugin"/> class.
        /// </summary>
        public Plugin(
            IApplicationPaths applicationPaths,
            IXmlSerializer xmlSerializer,
            ILogger<Plugin> logger)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
            _appPaths = applicationPaths;
            _logger = logger;
        }

        /// <summary>
        /// Gets the current plugin instance.
        /// </summary>
        public static Plugin? Instance { get; private set; }

        /// <inheritdoc />
        public override string Name => "Filter Search";

        /// <inheritdoc />
        public override Guid Id => Guid.Parse("b8f7e2c1-9a3d-4f5e-8b6c-1d2e3f4a5b6c");

        /// <inheritdoc />
        public override string Description => "Adds search functionality to filter dialogs and displays enabled filters at the top.";

        /// <summary>
        /// Gets the path to the index.html file.
        /// </summary>
        public string IndexHtmlPath => Path.Combine(_appPaths.WebPath, "index.html");

        /// <summary>
        /// Injects the filter search script into index.html.
        /// </summary>
        public void InjectScript()
        {
            var indexPath = IndexHtmlPath;
            if (!File.Exists(indexPath))
            {
                _logger.LogError("Could not find index.html at path: {Path}", indexPath);
                return;
            }

            var injectionBlock = JavascriptHelper.BuildInjectionBlock();
            if (string.IsNullOrEmpty(injectionBlock))
            {
                _logger.LogError("Failed to build injection block - script is empty");
                return;
            }

            try
            {
                var content = File.ReadAllText(indexPath);

                // Check if already injected with current content
                if (content.Contains(injectionBlock))
                {
                    _logger.LogInformation("Filter Search script is already correctly injected. No changes needed.");
                    return;
                }

                // Remove any existing injection block first
                var cleanupRegex = new Regex($"{Regex.Escape(JavascriptHelper.StartComment)}[\\s\\S]*?{Regex.Escape(JavascriptHelper.EndComment)}", RegexOptions.Multiline);
                content = cleanupRegex.Replace(content, string.Empty);

                // Inject before </body>
                var closingBodyTag = "</body>";
                if (content.Contains(closingBodyTag))
                {
                    content = content.Replace(closingBodyTag, $"{injectionBlock}\n{closingBodyTag}");
                    File.WriteAllText(indexPath, content);
                    _logger.LogInformation("Successfully injected Filter Search script into index.html");
                }
                else
                {
                    _logger.LogWarning("Could not find </body> tag in index.html. Script not injected.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while trying to inject script into index.html");
            }
        }

        /// <summary>
        /// Removes the filter search script from index.html.
        /// </summary>
        public void RemoveScript()
        {
            var indexPath = IndexHtmlPath;
            if (!File.Exists(indexPath))
            {
                return;
            }

            try
            {
                var content = File.ReadAllText(indexPath);
                var cleanupRegex = new Regex($"{Regex.Escape(JavascriptHelper.StartComment)}[\\s\\S]*?{Regex.Escape(JavascriptHelper.EndComment)}\\s*", RegexOptions.Multiline);

                if (cleanupRegex.IsMatch(content))
                {
                    content = cleanupRegex.Replace(content, string.Empty);
                    File.WriteAllText(indexPath, content);
                    _logger.LogInformation("Successfully removed Filter Search script from index.html");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while trying to remove script from index.html");
            }
        }

        /// <inheritdoc />
        public override void OnUninstalling()
        {
            RemoveScript();
            base.OnUninstalling();
        }

        /// <inheritdoc />
        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = Name,
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.html"
                }
            };
        }

        /// <summary>
        /// Gets the plugin thumb image.
        /// </summary>
        /// <returns>The thumb image stream.</returns>
        public Stream? GetThumbImage()
        {
            var type = GetType();
            return type.Assembly.GetManifestResourceStream(type.Namespace + ".icon.png");
        }

        /// <summary>
        /// Gets the thumb image format.
        /// </summary>
        public ImageFormat ThumbImageFormat => ImageFormat.Png;
    }
}
