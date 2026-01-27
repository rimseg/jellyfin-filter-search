#nullable enable
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.FilterSearch.Services
{
    /// <summary>
    /// Startup service that injects the filter search JavaScript into index.html.
    /// </summary>
    public class StartupService : IScheduledTask
    {
        private readonly ILogger<StartupService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="StartupService"/> class.
        /// </summary>
        public StartupService(ILogger<StartupService> logger)
        {
            _logger = logger;
        }

        /// <inheritdoc />
        public string Name => "Filter Search Startup";

        /// <inheritdoc />
        public string Key => "FilterSearchStartup";

        /// <inheritdoc />
        public string Description => "Injects the Filter Search JavaScript into the Jellyfin web interface.";

        /// <inheritdoc />
        public string Category => "Startup Services";

        /// <inheritdoc />
        public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Filter Search startup task executing...");

            if (Plugin.Instance == null)
            {
                _logger.LogError("Filter Search plugin instance is not available");
                return Task.CompletedTask;
            }

            Plugin.Instance.InjectScript();

            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
        {
            return new[]
            {
                new TaskTriggerInfo
                {
                    Type = TaskTriggerInfo.TriggerStartup
                }
            };
        }
    }
}
