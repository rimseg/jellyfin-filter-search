#nullable enable
using System;
using Jellyfin.Plugin.FilterSearch.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.FilterSearch.Controllers
{
    /// <summary>
    /// Controller that serves the Filter Search JavaScript.
    /// </summary>
    [ApiController]
    [Route("FilterSearch")]
    public class FilterSearchController : ControllerBase
    {
        /// <summary>
        /// Gets the filter search JavaScript code.
        /// </summary>
        /// <param name="v">Script version from the loader; a matching version can be cached long-term.</param>
        /// <returns>The JavaScript content.</returns>
        [HttpGet("filter-search.js")]
        [AllowAnonymous]
        [Produces("application/javascript")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status304NotModified)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public ActionResult GetScript([FromQuery] string? v)
        {
            byte[] script = JavascriptHelper.ScriptBytes;
            if (script.Length == 0)
            {
                return NotFound("// Script not found");
            }

            string version = JavascriptHelper.ScriptVersion;
            string etag = "\"" + version + "\"";
            Response.Headers.ETag = etag;

            // The loader requests "?v=<content hash>", so that URL never changes content and can be cached
            // until the plugin is updated. Unversioned requests must revalidate.
            Response.Headers.CacheControl = string.Equals(v, version, StringComparison.Ordinal)
                ? "public, max-age=31536000, immutable"
                : "no-cache";

            if (string.Equals(Request.Headers.IfNoneMatch.ToString(), etag, StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status304NotModified);
            }

            return File(script, "application/javascript; charset=utf-8");
        }

        /// <summary>
        /// Gets a loader script that can be manually added to index.html or loaded via bookmarklet.
        /// </summary>
        /// <returns>A small loader script.</returns>
        [HttpGet("loader.js")]
        [AllowAnonymous]
        [Produces("application/javascript")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult GetLoader()
        {
            var loader = @"
(function() {
    'use strict';
    // Filter Search Loader
    if (window.filterSearchLoaded) return;
    window.filterSearchLoaded = true;

    var script = document.createElement('script');
    script.src = ApiClient.getUrl('FilterSearch/filter-search.js') + '?v=" + JavascriptHelper.ScriptVersion + @"';
    document.head.appendChild(script);
    console.log('Filter Search: Loading script...');
})();
";
            return Content(loader.Trim(), "application/javascript");
        }
    }
}
