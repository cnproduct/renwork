# Voiceover V9 — Personal OAuth on each RenWork device

This voiceover supersedes the V8 rule that members can never connect OAuth.
It creates one narrow exception: a signed-in user may connect their own approved
consumer OAuth account independently on several computers that they personally
use. It does not create a shared team credential.

1. A platform super administrator enables an OpenAI or Google **device OAuth
   policy** in the RenWork model catalog. The catalog contains model permissions,
   pricing, device limits and concurrency limits, but never contains an OAuth
   access token, refresh token, authorization code or browser cookie.

2. On each Mac, Windows or Linux computer, the same RenWork user selects
   “Connect this device” and completes the provider login in the browser. The raw
   credential is stored only in that computer's OS-protected credential vault.
   It is not uploaded to Den, copied to another computer or exposed to an
   organization Owner. Every additional computer requires a separate login.

3. Den registers only a content-free device record: organization, member,
   opaque device ID, public-key fingerprint, approval status and last-seen time.
   A platform super administrator can approve or revoke that execution device.
   Revocation prevents new reservations without remotely extracting the local
   provider credential.

4. The provider card in the super-admin console distinguishes “service secret”
   from “device OAuth.” A service secret belongs to the cloud gateway and may be
   organization-scoped. Device OAuth is always `device_vault`,
   `personal_device` and `user_private`; the catalog rejects a Base URL or server
   secret attached to it. “Adapter self-check” validates this policy contract,
   while actual account/token health is checked on each approved device.

5. Starting any approved OAuth model call still requires an online RenCredit
   reservation. The local runtime executes the call, measures provider-reported
   token categories or an approved tokenizer fallback, signs a content-free
   receipt with the device key, and asks the persistent multi-tenant ledger to
   capture actual usage and release the unused freeze.

6. A failure, cancellation, expired approval, revoked device, invalid signature,
   duplicate receipt or unavailable RenCredit service cannot become an
   unmetered direct call. The run fails closed and the reservation is released or
   reconciled by the existing RenCredit rules.

7. Ordinary members and organization Owners may connect only their own allowed
   account on their own approved devices. They cannot export the token, publish
   it as an organization provider, share it with teammates, edit platform rates,
   or turn off metering. Owners retain only model whitelist, default model,
   organization budget and member quota controls.

8. Team-wide and unattended cloud execution must use a separately licensed
   server-side API organization/project or another approved service provider.
   A personal Plus/Pro/Ultra OAuth credential is never silently converted into a
   shared team pool.

9. Acceptance requires at least two computers for the same user plus a second
   isolated tenant. It proves per-device login, token non-transfer, pending →
   active → revoked lifecycle, device-limit rejection, RenCredit reserve/capture,
   failure release, idempotent receipt handling and tenant isolation. Source
   tests and screenshots alone are not production OAuth billing proof.
