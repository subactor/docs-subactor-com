---
{
  "schema": "subactor.doc/v1",
  "id": "docs.todo",
  "version": 1,
  "status": "current",
  "updated": "2026-07-19"
}
---

# TODO

- [ ] Correct DNS/TLS for `identity.subactor.com` and `chat.subactor.com`.
- [ ] Confirm Plesk add-on domain quota through an authoritative panel/API path.
- [ ] Configure a trusted HTTPS Plesk endpoint; live `auth/query/status` is fail-closed with `plesk_https_required`.
- [ ] Document credential bootstrap and phone-provider legal requirements.
- [ ] Keep the live status report synchronized with tested evidence.
- [ ] Add an umbrella manifest/bootstrap for the independent `platform`, `docs`, `logo` and `www` repositories.
- [x] Wire the read-only Access Resolver path to live urirun discovery, auth status, scope proof and acquisition-method routes.
- [x] Persist Access Resolver events in a mode-0600, hash-chained append-only outbox and verify it after a live probe.
- [x] Gate the official bootstrap/refresh/delegate executor with signed, one-time child grants bound to the exact command and `plan_hash`.
- [ ] Enforce child-grant verification at every native connector/urirun command boundary and remove broad node-token bypass paths.
- [ ] Persist consent resumptions and process expiry/revocation records from the evidence outbox.
- [ ] Roll out secret-free auth conformance to DNS, GitHub, e-mail, voice and e-sign connectors.
- [ ] Add a typed notification outbox only for AQL/consent/MFA/root-of-trust blockers after automatic strategies are exhausted.
