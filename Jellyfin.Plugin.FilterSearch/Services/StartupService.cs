#nullable enable
using System.Text.RegularExpressions;
using Jellyfin.Plugin.FilterSearch.Helpers;
using Jellyfin.Plugin.FilterSearch.JellyfinVersionSpecific;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.FilterSearch.Services
{
    /// <summary>
    /// Startup task that removes script blocks written into index.html by plugin versions before 2.0.
    /// The loader is now added to the served page in memory by the startup filter, so index.html
    /// is never modified on disk.
    /// </summary>
    public class StartupService : IScheduledTask
    {
        private readonly ILogger<StartupService> _logger;
        private readonly IApplicationPaths _appPaths;

        /// <summary>
        /// Initializes a new instance of the <see cref="StartupService"/> class.
        /// </summary>
        public StartupService(ILogger<StartupService> logger, IApplicationPaths appPaths)
        {
            _logger = logger;
            _appPaths = appPaths;
        }

        /// <inheritdoc />
        public string Name => "Filter Search Startup";

        /// <inheritdoc />
        public string Key => "FilterSearchStartup";

        /// <inheritdoc />
        public string Description => "Removes Filter Search script blocks left in index.html by older plugin versions.";

        /// <inheritdoc />
        public string Category => "Startup Services";

        /// <inheritdoc />
        public async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
        {
            await Task.Run(CleanupOldScript, cancellationToken).ConfigureAwait(false);
        }

        /// <summary>
        /// Removes any old script blocks that may have been injected by previous versions.
        /// Best effort: if index.html is read-only the block stays, and the middleware skips injecting twice.
        /// </summary>
        private void CleanupOldScript()
        {
            try
            {
                var indexPath = Path.Combine(_appPaths.WebPath, "index.html");
                if (!File.Exists(indexPath))
                {
                    return;
                }

                var content = File.ReadAllText(indexPath);
                var cleanupRegex = new Regex(
                    $"{Regex.Escape(JavascriptHelper.StartComment)}[\\s\\S]*?{Regex.Escape(JavascriptHelper.EndComment)}\\s*",
                    RegexOptions.Multiline);

                if (cleanupRegex.IsMatch(content))
                {
                    File.WriteAllText(indexPath, cleanupRegex.Replace(content, string.Empty));
                    _logger.LogInformation("Removed Filter Search script block left in index.html by an older plugin version.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not remove the old Filter Search script block from index.html. It is harmless and will not be injected twice.");
            }
        }

        /// <inheritdoc />
        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers() => StartupServiceHelper.GetDefaultTriggers();
    }
}
