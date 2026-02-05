// Redirect shortcut for the weekly service submission form.
// Shareable URL: /api/functions/SundayMessage
// Redirects to: /api/functions/serveWeeklyServiceSubmission
Deno.serve((req) => {
    const targetUrl = new URL('/api/functions/serveWeeklyServiceSubmission', req.url);
    return Response.redirect(targetUrl.toString(), 302);
});