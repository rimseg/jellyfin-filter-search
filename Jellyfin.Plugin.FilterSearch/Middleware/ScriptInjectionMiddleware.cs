#nullable enable
using System.Text;
using Jellyfin.Plugin.FilterSearch.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.FilterSearch.Middleware
{
    /// <summary>
    /// Middleware that injects the Filter Search script into index.html responses.
    /// This approach doesn't require file write permissions.
    /// </summary>
    public class ScriptInjectionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ScriptInjectionMiddleware> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ScriptInjectionMiddleware"/> class.
        /// </summary>
        public ScriptInjectionMiddleware(RequestDelegate next, ILogger<ScriptInjectionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        /// <summary>
        /// Processes the HTTP request and injects script into index.html if applicable.
        /// </summary>
        public async Task InvokeAsync(HttpContext context)
        {
            // Only intercept requests for index.html
            var path = context.Request.Path.Value ?? string.Empty;
            
            if (!IsIndexHtmlRequest(path))
            {
                await _next(context);
                return;
            }

            // Check if plugin is enabled
            if (Plugin.Instance?.Configuration?.Enabled != true)
            {
                await _next(context);
                return;
            }

            // Capture the original response
            var originalBodyStream = context.Response.Body;

            using var newBodyStream = new MemoryStream();
            context.Response.Body = newBodyStream;

            await _next(context);

            // Only process successful HTML responses
            if (context.Response.StatusCode == 200 && 
                IsHtmlResponse(context.Response.ContentType))
            {
                newBodyStream.Seek(0, SeekOrigin.Begin);
                var originalContent = await new StreamReader(newBodyStream).ReadToEndAsync();

                var modifiedContent = InjectScript(originalContent);

                var modifiedBytes = Encoding.UTF8.GetBytes(modifiedContent);
                context.Response.ContentLength = modifiedBytes.Length;

                await originalBodyStream.WriteAsync(modifiedBytes);
                _logger.LogDebug("Filter Search script injected into index.html response");
            }
            else
            {
                // Pass through unmodified
                newBodyStream.Seek(0, SeekOrigin.Begin);
                await newBodyStream.CopyToAsync(originalBodyStream);
            }

            context.Response.Body = originalBodyStream;
        }

        private static bool IsIndexHtmlRequest(string path)
        {
            return path.Equals("/", StringComparison.OrdinalIgnoreCase) ||
                   path.Equals("/index.html", StringComparison.OrdinalIgnoreCase) ||
                   path.Equals("/web/", StringComparison.OrdinalIgnoreCase) ||
                   path.Equals("/web/index.html", StringComparison.OrdinalIgnoreCase) ||
                   path.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsHtmlResponse(string? contentType)
        {
            return contentType != null && 
                   contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase);
        }

        private string InjectScript(string content)
        {
            // Don't inject if already present
            if (content.Contains(JavascriptHelper.StartComment))
            {
                return content;
            }

            var injectionBlock = JavascriptHelper.BuildInjectionBlock();
            if (string.IsNullOrEmpty(injectionBlock))
            {
                return content;
            }

            // Inject before </body>
            const string closingBodyTag = "</body>";
            var bodyIndex = content.LastIndexOf(closingBodyTag, StringComparison.OrdinalIgnoreCase);
            
            if (bodyIndex >= 0)
            {
                return content.Insert(bodyIndex, injectionBlock + "\n");
            }

            return content;
        }
    }
}
