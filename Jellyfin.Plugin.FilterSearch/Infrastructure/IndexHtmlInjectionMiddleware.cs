#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading.Tasks;
using Jellyfin.Plugin.FilterSearch.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

namespace Jellyfin.Plugin.FilterSearch.Infrastructure
{
    /// <summary>
    /// Injects the Filter Search loader into the web client's index.html response.
    /// All other requests pass straight through.
    /// </summary>
    public sealed class IndexHtmlInjectionMiddleware
    {
        // Request headers rewritten for the inner pipeline. They are restored afterwards, so middleware
        // that runs outside this one (for example File Transformation's) still sees the client's request.
        private static readonly string[] _rewrittenHeaders =
        {
            HeaderNames.AcceptEncoding,
            HeaderNames.Range,
            HeaderNames.IfRange,
            HeaderNames.IfModifiedSince,
            HeaderNames.IfNoneMatch,
        };

        private readonly RequestDelegate _next;
        private readonly ILogger<IndexHtmlInjectionMiddleware> _logger;

        // index.html only changes when Jellyfin is updated, so the transformed (and compressed) page is
        // cached per ETag of the original file and reused until that ETag changes.
        private volatile CachedPage? _cache;

        /// <summary>
        /// Initializes a new instance of the <see cref="IndexHtmlInjectionMiddleware"/> class.
        /// </summary>
        /// <param name="next">The next request delegate.</param>
        /// <param name="logger">The logger.</param>
        public IndexHtmlInjectionMiddleware(RequestDelegate next, ILogger<IndexHtmlInjectionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        /// <summary>
        /// Processes a request.
        /// </summary>
        /// <param name="context">The HTTP context.</param>
        /// <returns>A task.</returns>
        public async Task InvokeAsync(HttpContext context)
        {
            var request = context.Request;
            bool isGet = HttpMethods.IsGet(request.Method);
            if ((!isGet && !HttpMethods.IsHead(request.Method)) || !IsIndexHtmlRequest(request.Path))
            {
                await _next(context).ConfigureAwait(false);
                return;
            }

            string etagSuffix = "-fs" + JavascriptHelper.ScriptVersion;
            string? encoding = SelectEncoding(request.Headers.AcceptEncoding.ToString());

            // Ask the inner pipeline for the full, uncompressed file. The ETag is re-mapped so that a copy
            // cached before the plugin was installed (or by another plugin version) is never revalidated.
            var savedHeaders = new StringValues[_rewrittenHeaders.Length];
            for (int i = 0; i < _rewrittenHeaders.Length; i++)
            {
                savedHeaders[i] = request.Headers[_rewrittenHeaders[i]];
                request.Headers.Remove(_rewrittenHeaders[i]);
            }

            string? originalTags = MapIfNoneMatch(savedHeaders[Array.IndexOf(_rewrittenHeaders, HeaderNames.IfNoneMatch)], etagSuffix);
            if (originalTags != null)
            {
                request.Headers.IfNoneMatch = originalTags;
            }

            Stream originalBody = context.Response.Body;
            using var buffer = new MemoryStream();
            context.Response.Body = buffer;
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            finally
            {
                context.Response.Body = originalBody;
                for (int i = 0; i < _rewrittenHeaders.Length; i++)
                {
                    if (StringValues.IsNullOrEmpty(savedHeaders[i]))
                    {
                        request.Headers.Remove(_rewrittenHeaders[i]);
                    }
                    else
                    {
                        request.Headers[_rewrittenHeaders[i]] = savedHeaders[i];
                    }
                }
            }

            var response = context.Response;
            string etag = response.Headers.ETag.ToString();
            if (etag.Length > 0)
            {
                response.Headers.ETag = AddSuffix(etag, etagSuffix);
            }

            response.Headers.Append(HeaderNames.Vary, HeaderNames.AcceptEncoding);

            if (!isGet)
            {
                response.ContentLength = null;
                return;
            }

            buffer.Position = 0;
            if (response.StatusCode == StatusCodes.Status200OK
                && response.Headers.ContentEncoding.Count == 0
                && (response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) ?? false))
            {
                CachedPage? page = _cache;
                if (page == null || etag.Length == 0 || !string.Equals(page.SourceETag, etag, StringComparison.Ordinal))
                {
                    string html = Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
                    string? injected = JavascriptHelper.InjectInto(html);
                    page = injected == null ? null : new CachedPage(etag, Encoding.UTF8.GetBytes(injected));
                    if (page != null && etag.Length > 0)
                    {
                        _cache = page;
                    }
                }

                if (page != null)
                {
                    byte[] bytes = page.GetBody(encoding);
                    if (encoding != null)
                    {
                        response.Headers.ContentEncoding = encoding;
                    }

                    response.ContentLength = bytes.Length;
                    await originalBody.WriteAsync(bytes, context.RequestAborted).ConfigureAwait(false);
                    return;
                }

                _logger.LogDebug("Filter Search loader already present or no </body> tag; serving index.html unchanged");
            }

            await buffer.CopyToAsync(originalBody, context.RequestAborted).ConfigureAwait(false);
        }

        private static bool IsIndexHtmlRequest(PathString path)
        {
            string value = path.Value ?? string.Empty;
            return value.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
                || value.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase);
        }

        private static string? SelectEncoding(string acceptEncoding)
        {
            bool br = false, gzip = false;
            foreach (string entry in acceptEncoding.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                string[] parts = entry.Split(';', StringSplitOptions.TrimEntries);
                bool rejected = Array.Exists(parts, p => p.Replace(" ", string.Empty, StringComparison.Ordinal) is "q=0" or "q=0.0" or "q=0.00" or "q=0.000");
                if (rejected)
                {
                    continue;
                }

                br |= parts[0].Equals("br", StringComparison.OrdinalIgnoreCase);
                gzip |= parts[0].Equals("gzip", StringComparison.OrdinalIgnoreCase);
            }

            return br ? "br" : gzip ? "gzip" : null;
        }

        private static string AddSuffix(string etag, string suffix)
        {
            return etag.EndsWith('"') ? string.Concat(etag.AsSpan(0, etag.Length - 1), suffix, "\"") : etag + suffix;
        }

        /// <summary>
        /// Maps the client's If-None-Match to the original file's ETags. Only tags this middleware issued
        /// (ending in the current suffix) are kept; anything else (a copy cached before the plugin was
        /// installed, another plugin version, or "*") is dropped, so the client gets the full page.
        /// </summary>
        private static string? MapIfNoneMatch(StringValues ifNoneMatch, string suffix)
        {
            if (StringValues.IsNullOrEmpty(ifNoneMatch) || !EntityTagHeaderValue.TryParseList(ifNoneMatch, out IList<EntityTagHeaderValue>? tags))
            {
                return null;
            }

            string quotedSuffix = suffix + "\"";
            var kept = new List<string>();
            foreach (EntityTagHeaderValue tag in tags)
            {
                string value = tag.Tag.ToString();
                if (value.EndsWith(quotedSuffix, StringComparison.Ordinal))
                {
                    kept.Add((tag.IsWeak ? "W/" : string.Empty) + string.Concat(value.AsSpan(0, value.Length - quotedSuffix.Length), "\""));
                }
            }

            return kept.Count == 0 ? null : string.Join(", ", kept);
        }

        private sealed class CachedPage
        {
            private readonly Lazy<byte[]> _gzip;
            private readonly Lazy<byte[]> _brotli;

            public CachedPage(string sourceETag, byte[] body)
            {
                SourceETag = sourceETag;
                Body = body;
                _gzip = new Lazy<byte[]>(() => Compress(body, s => new GZipStream(s, CompressionLevel.Optimal, true)));
                _brotli = new Lazy<byte[]>(() => Compress(body, s => new BrotliStream(s, CompressionLevel.Optimal, true)));
            }

            public string SourceETag { get; }

            public byte[] Body { get; }

            public byte[] GetBody(string? encoding) => encoding switch
            {
                "br" => _brotli.Value,
                "gzip" => _gzip.Value,
                _ => Body,
            };

            private static byte[] Compress(byte[] data, Func<Stream, Stream> createCompressor)
            {
                using var output = new MemoryStream();
                using (Stream compressor = createCompressor(output))
                {
                    compressor.Write(data, 0, data.Length);
                }

                return output.ToArray();
            }
        }
    }
}
