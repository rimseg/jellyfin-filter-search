#nullable enable
using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Plugin.FilterSearch.Infrastructure
{
    /// <summary>
    /// Adds <see cref="IndexHtmlInjectionMiddleware"/> to the front of Jellyfin's request pipeline,
    /// so the loader is added to index.html in memory instead of editing the file on disk.
    /// </summary>
    public sealed class FilterSearchStartupFilter : IStartupFilter
    {
        /// <inheritdoc />
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                app.UseMiddleware<IndexHtmlInjectionMiddleware>();
                next(app);
            };
        }
    }
}
