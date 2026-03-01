/**
 * serveArtsSubmission.js
 * 
 * DEPRECATED (2026-03-01): This function previously served a full HTML form.
 * The form has been migrated to a React page (PublicArtsForm) as part of
 * the CSP Migration (Decision: 2026-02-27).
 * 
 * This function now returns a redirect to the React page to prevent user confusion
 * from old bookmarks or shared links. The JSON data endpoint (getArtsFormData)
 * and submission handler (submitArtsSegment) remain active.
 * 
 * DO NOT DELETE: Old links may still be in circulation. This redirect ensures
 * users land on the correct form without a broken page.
 */

Deno.serve(async (req) => {
    const url = new URL(req.url);
    const eventId = url.searchParams.get('event_id');
    
    const appOrigin = url.origin;
    const reactPagePath = '/PublicArtsForm';
    const redirectUrl = eventId 
        ? `${appOrigin}${reactPagePath}?event_id=${encodeURIComponent(eventId)}`
        : `${appOrigin}${reactPagePath}`;

    return new Response(null, {
        status: 302,
        headers: {
            'Location': redirectUrl,
            'Cache-Control': 'no-store, no-cache',
        }
    });
});