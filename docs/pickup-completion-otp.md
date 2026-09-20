# Pickup completion OTP

Regular pickup completion requires OTP verification. Recurring pickups complete
without OTP, using their stored recurring contract link. Both flows require the
assigned agent, an in-progress pickup, and saved weight. Recurring completion
keeps the existing monthly invoice flow. Clients cannot change a pickup's recurring
contract link through the regular update endpoint. There is no development
code in API responses and no fallback that completes without verification.

## Local console testing

Pickup verification reuses the login OTP generator by default. Set `PICKUP_OTP_MODE=login` in the backend
`.env`, then restart the backend. Requesting a pickup OTP prints a six-digit
code in the backend terminal, with the customer's last four phone digits.
No SMS is sent in this mode. Enter that code in the agent modal. Codes expire
after five minutes, are single-use, and are lost on server restart.
Login and pickup codes use separate namespaces, so one cannot authorize the other.
This default has the same in-memory, single-process limitation as login: restart
invalidates codes. Real customer SMS requires the optional provider below.
The legacy `console` mode is an alias limited to development.

## Server setup

Create a Twilio account and a **dedicated Twilio Verify service for pickup
completion**, configured for six-digit SMS codes. Add these server environment
variables in the backend hosting settings, then restart/deploy the backend:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PICKUP_VERIFY_SERVICE_SID`
- `PICKUP_OTP_MODE=twilio`

Do not place credentials in Expo or web frontend settings or commit them.
Configure the Verify service's permitted destination countries, spending limits,
and provider requirements for sending to your customers. Trial accounts have
destination restrictions. See https://www.twilio.com/docs/verify/api/verification.

Twilio mode returns 503 if its credentials are missing. Default login mode needs
no SMS credentials and prints the working code in the backend console.

## Flow

1. Assigned agent saves weight on an in-progress pickup and taps Complete pickup.
2. `POST /api/v1/pickups/:id/completion-otp` generates a code for the customer's saved phone.
   The response contains only a masked number, expiry, resend delay and delivery mode.
3. Agent enters the customer's code in the mobile dialog.
4. `PATCH /api/v1/pickups/:id/complete` with `{ "otp": "123456" }` verifies the
   code before the existing completion/payment logic runs.

The local challenge expires after five minutes, permits five checks, and limits
sends to one per minute and five per hour per pickup. The provider can impose
additional limits. Challenges are bound to the assigned agent, customer, phone,
and saved weight. Changed details require a new request. A verified code is
single-use; if a subsequent billing step fails, resolve that issue and resend.
Update-status requests cannot set `completed`.

Completion uses a persistent per-pickup lock to prevent concurrent completion,
editing, cancellation or deletion while verification/payment is in progress.
Locks are released on normal success and failure. After a server crash during
completion, an administrator must inspect payment and pickup state before
clearing a stranded `completionLockId`; do not automatically retry billing.
An OTP challenge stranded in `sending` or `verifying` similarly requires
inspection/reset after a crash. Do not expose these internal fields to clients.

Deploy both the backend and mobile update together. Older clients without OTP
submission cannot complete pickups after backend deployment. No live SMS was
sent during implementation; verify delivery and the full completion/payment
flow using a test pickup after configuring the provider.
