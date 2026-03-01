/**
 * serveWeeklyServiceSubmission.js
 * 
 * DEPRECATED (2026-03-01): This function previously served a full HTML form.
 * The form has been migrated to a React page (PublicWeeklyForm) as part of
 * the CSP Migration (Decision: 2026-02-27).
 * 
 * This function now returns a redirect to the React page to prevent user confusion
 * from old bookmarks or shared links. The JSON data endpoint (getWeeklyFormData)
 * and submission handler (submitWeeklyServiceContent) remain active.
 * 
 * DO NOT DELETE: Old links may still be in circulation. This redirect ensures
 * users land on the correct form without a broken page.
 */

Deno.serve(async (req) => {
    const url = new URL(req.url);
    
    const appOrigin = url.origin;
    const reactPagePath = '/PublicWeeklyForm';

    return new Response(null, {
        status: 302,
        headers: {
            'Location': `${appOrigin}${reactPagePath}`,
            'Cache-Control': 'no-store, no-cache',
        }
    });
});