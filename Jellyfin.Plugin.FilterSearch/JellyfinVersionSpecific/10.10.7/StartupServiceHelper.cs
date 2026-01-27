using MediaBrowser.Model.Tasks;
using System.Collections.Generic;

namespace Jellyfin.Plugin.FilterSearch.JellyfinVersionSpecific
{
    /// <summary>
    /// Helper class for version-specific startup trigger configuration.
    /// This file is for Jellyfin 10.10.7.
    /// </summary>
    public static class StartupServiceHelper
    {
        /// <summary>
        /// Gets the default triggers for the startup task.
        /// </summary>
        /// <returns>A collection of task trigger info.</returns>
        public static IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
        {
            yield return new TaskTriggerInfo()
            {
                Type = TaskTriggerInfo.TriggerStartup
            };
        }
    }
}
