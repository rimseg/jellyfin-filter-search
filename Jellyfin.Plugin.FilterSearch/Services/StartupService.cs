#nullable enable
using System.Reflection;
using System.Runtime.Loader;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.FilterSearch.Helpers;
using Jellyfin.Plugin.FilterSearch.JellyfinVersionSpecific;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.FilterSearch.Services
{
    /// <summary>
    /// Startup service that injects the filter search JavaScript into index.html.
    /// Supports both the File Transformation plugin and fallback direct injection.
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
        public string Description => "Injects the Filter Search JavaScript into the Jellyfin web interface.";

        /// <inheritdoc />
        public string Category => "Startup Services";

        /// <inheritdoc />
        public async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
        {
            await Task.Run(() =>
            {
                CleanupOldScript();
                RegisterFileTransformation();
            }, cancellationToken);
        }

        /// <summary>
        /// Removes any old script blocks that may have been injected by previous versions.
        /// </summary>
        private void CleanupOldScript()
        {
            try
            {
                var indexPath = Path.Combine(_appPaths.WebPath, "index.html");
                if (!File.Exists(indexPath))
                {
                    _logger.LogWarning("Could not find index.html at path: {Path}. Unable to perform cleanup.", indexPath);
                    return;
                }

                var content = File.ReadAllText(indexPath);
                var startComment = Regex.Escape(JavascriptHelper.StartComment);
                var endComment = Regex.Escape(JavascriptHelper.EndComment);

                var cleanupRegex = new Regex($"{startComment}[\\s\\S]*?{endComment}\\s*", RegexOptions.Multiline);

                if (cleanupRegex.IsMatch(content))
                {
                    _logger.LogInformation("Found old Filter Search script block in index.html. Removing it now.");
                    content = cleanupRegex.Replace(content, string.Empty);
                    File.WriteAllText(indexPath, content);
                    _logger.LogInformation("Successfully removed old script block.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during cleanup of old script from index.html.");
            }
        }

        /// <summary>
        /// Registers with the File Transformation plugin if available, otherwise falls back to direct injection.
        /// </summary>
        private void RegisterFileTransformation()
        {
            Assembly? fileTransformationAssembly =
                AssemblyLoadContext.All.SelectMany(x => x.Assemblies).FirstOrDefault(x =>
                    x.FullName?.Contains(".FileTransformation") ?? false);

            if (fileTransformationAssembly != null)
            {
                Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");

                if (pluginInterfaceType != null)
                {
                    var payload = new JObject
                    {
                        { "id", Plugin.Instance?.Id.ToString() },
                        { "fileNamePattern", "index.html" },
                        { "callbackAssembly", GetType().Assembly.FullName },
                        { "callbackClass", typeof(TransformationPatches).FullName },
                        { "callbackMethod", nameof(TransformationPatches.IndexHtml) }
                    };

                    pluginInterfaceType.GetMethod("RegisterTransformation")?.Invoke(null, new object?[] { payload });
                    _logger.LogInformation("Successfully registered Filter Search with the File Transformation plugin.");
                }
                else
                {
                    _logger.LogWarning("Could not find PluginInterface in FileTransformation assembly. Using fallback injection method.");
                    FallbackInjectScript();
                }
            }
            else
            {
                _logger.LogWarning("File Transformation plugin not found. Using fallback injection method.");
                FallbackInjectScript();
            }
        }

        /// <summary>
        /// Fallback method to inject the script directly into index.html when File Transformation is not available.
        /// </summary>
        private void FallbackInjectScript()
        {
            if (Plugin.Instance != null)
            {
                Plugin.Instance.InjectScript();
            }
        }

        /// <inheritdoc />
        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers() => StartupServiceHelper.GetDefaultTriggers();
    }
}
