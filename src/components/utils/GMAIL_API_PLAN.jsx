/* eslint-disable */
// # Gmail API Integration Plan for Transactional Emails

**Status:** Ready to implement - feasibility confirmed ✅  
**Priority:** Future enhancement  
**Estimated Time:** 45 minutes (30 min setup, 15 min code)  
**Cost:** $0 (replaces SendGrid)

---

## Feasibility: All Requirements Met ✅

1. Service Account Credentials - Store as `GOOGLE_SERVICE_ACCOUNT_JSON` secret
2. JWT Signing + OAuth - Deno Web Crypto API (native)
3. HTTPS to Gmail API - Standard fetch()
4. Domain-Wide Delegation - Via `subject` claim
5. Platform Restrictions - None blocking

---

## Implementation Steps

### Phase 1: Google Workspace Setup (30 min)
1. Create service account in Google Cloud Console
2. Enable Gmail API
3. Enable domain-wide delegation
4. Authorize scopes in Workspace Admin: `https://www.googleapis.com/auth/gmail.send`

### Phase 2: Backend Function (15 min)
Create `functions/sendEmailViaGmail.js` with:
- JWT generation using Web Crypto API
- OAuth token exchange
- Gmail API send via HTTPS
- RFC 2822 message formatting

### Phase 3: Configure Secret
`GOOGLE_SERVICE_ACCOUNT_JSON` = service account JSON key

### Phase 4: Frontend Usage
```javascript
await base44.functions.invoke('sendEmailViaGmail', {
  to: email,
  subject: 'Test',
  body: '<h1>Hello</h1>',
  from: 'no-reply@yourdomain.com'
});
```

---

## Benefits vs SendGrid
- $0 cost (vs $15-100/mo)
- Native Workspace integration
- Emails appear in sent folder
- Native SPF/DKIM/DMARC
- Full brand control

---

**Prerequisites:** Google Workspace admin access, sending domain decided, 45 min available

**Full implementation details preserved in this doc for future reference.**