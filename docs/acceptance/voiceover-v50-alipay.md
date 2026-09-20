# Voiceover V50 production acceptance

Status: pending merchant key rotation and a controlled real payment/refund. Keep `RENWORK_ALIPAY_ONLINE_ENABLED=false` until the acceptance window. PR #82 and CI do not deploy the payment code.

## Key handoff

1. The merchant operator replaces the exposed application signing key in the Alipay Open Platform and confirms that the application uses RSA2 public-key mode and has production web payment/refund capability. The old private key must no longer authorize requests. The new application private key stays in a local file under the operator's control; never paste it into chat, WebShell, Git, CI logs, or a Compose environment variable.
2. Transfer that file to `/opt/renwork-auth/secrets/alipay-app-private.pem` over the existing SSH connection, with host directory mode `0700` and file mode `0600`, owned by root. Do not print, inspect, or record its contents in the acceptance log. Record only the file's existence, mode, size and public-key fingerprint.
3. Configure `RENWORK_ALIPAY_APP_ID`, `RENWORK_ALIPAY_SELLER_ID`, and the **Alipay public key** in the root-only production `.env`. These values must match the same merchant application. The private key is read from `/run/renwork-secrets/alipay-app-private.pem` inside Den and is absent from Docker's environment list.
4. Deploy the reviewed V50 Den image, migrations `0074`–`0076`, and the matching production Compose configuration while the online switch remains false. Check Den health, disabled checkout status, and the public callback route. The host's current Compose file may have later changes: merge only the payment environment and read-only secret mount into it after comparing the live file with the PR version.

## Controlled payment

1. Set `RENWORK_ALIPAY_CANARY_ORGANIZATION_ID` to the exact test organization's immutable ID. Only then temporarily set `RENWORK_ALIPAY_ONLINE_ENABLED=true` and restart Den. Confirm checkout is available for that organization and unavailable for another organization.
2. The merchant operator completes one real payment in Alipay. Record the order ID, merchant transaction ID, exact CNY amount, callback receipt, organization entitlement, wallet before/after, and the immutable RenCredit grant entry. A browser return alone is not acceptance.
3. Use the guarded admin refund route for a full refund. Confirm the signed Alipay refund response, original payment record, refund record, entitlement revocation, wallet before/after and reversal entry. Repeating the notification and refund must not duplicate grants or reversals. If the refund is ambiguous or reports `fund_change=N`, stop and reconcile with Alipay before changing entitlements manually.
4. Set the switch back to false. Keep PR #82 in draft until the real receipt, refund, ledger and Testkit evidence are attached. A separate decision is required to make online payment generally available.
