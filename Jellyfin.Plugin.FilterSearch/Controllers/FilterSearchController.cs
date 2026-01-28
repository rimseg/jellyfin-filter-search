#nullable enable
using System.IO;
using System.Reflection;
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
        /// <returns>The JavaScript content.</returns>
        [HttpGet("filter-search.js")]
        [AllowAnonymous]
        [Produces("application/javascript")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public ActionResult GetScript()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var resourceName = "Jellyfin.Plugin.FilterSearch.Scripts.filter-search.js";

                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream == null)
                {
                    return NotFound("// Script not found");
                }

                using var reader = new StreamReader(stream);
                var script = reader.ReadToEnd();

                return Content(script, "application/javascript");
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError, "// Error loading script");
            }
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
    script.src = ApiClient.getUrl('FilterSearch/filter-search.js') + '?v=' + Date.now();
    document.head.appendChild(script);
    console.log('Filter Search: Loading script...');
})();
";
            return Content(loader.Trim(), "application/javascript");
        }
    }
}
