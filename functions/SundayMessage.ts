// Redirect shortcut for the weekly service submission form.
// Shareable URL: /api/functions/SundayMessage
// Redirects to: /api/functions/serveWeeklyServiceSubmission
Deno.serve((req) => {
    return new Response(null, {
        status: 302,
        headers: { 'Location': '/api/functions/serveWeeklyServiceSubmission' }
    });
});