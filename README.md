# SSP Backend Project

A learning project aligned with the Software Support Personnel job description:
- Node.js + Express REST API
- MongoDB + Mongoose
- Registration, login, logout, refresh and password-reset flow
- bcrypt password hashing
- JWT access tokens and rotating refresh tokens
- Admin/User RBAC
- Razorpay TEST order creation, payment signature verification and webhook endpoint
- Input validation, rate limiting, Helmet, centralized error handling
- Basic automated health-endpoint test

> This is a portfolio/learning implementation, not a production-certified payment system. Review the security notes below before deploying.

## 1. Requirements

- Node.js 18 or newer (Node 20 LTS recommended)
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas database
- Postman or another API client
- Optional: Razorpay test account for payment testing

## 2. Install

```bash
npm install
```

Copy `.env.example` to `.env` and set:
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- Optional Razorpay TEST credentials

Use long random secrets. Do not commit `.env`.

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Start MongoDB and the API

Start your local MongoDB service, then:

```bash
npm run dev
```

Expected:
- `MongoDB connected`
- `API listening on http://localhost:5000`

Check:
```http
GET http://localhost:5000/health
```

## 4. API endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create user |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/refresh` | Refresh cookie | Rotate refresh token |
| POST | `/api/auth/logout` | No | Invalidate refresh session |
| POST | `/api/auth/forgot-password` | No | Request reset |
| POST | `/api/auth/reset-password` | No | Set new password |
| GET | `/api/auth/me` | Access token | Current user |
| GET | `/api/users` | Admin | List users |
| PATCH | `/api/users/:id/role` | Admin | Change role |
| POST | `/api/payments/orders` | Access token | Create Razorpay order |
| POST | `/api/payments/verify` | Access token | Verify payment signature |
| GET | `/api/payments/mine` | Access token | Current user's payment records |
| POST | `/api/payments/webhook` | Razorpay signature | Receive payment events |

### Register

`POST /api/auth/register`
```json
{
  "name": "Irfan",
  "email": "irfan@example.com",
  "password": "A_Strong_Password_123"
}
```

The response contains an access token. The refresh token is set as an HttpOnly cookie.

### Login

`POST /api/auth/login`
```json
{
  "email": "irfan@example.com",
  "password": "A_Strong_Password_123"
}
```

For protected routes, set:
`Authorization: Bearer <accessToken>`

In Postman, enable cookie handling so the refresh cookie is sent to `/api/auth/refresh`.

### Refresh and logout

- `POST /api/auth/refresh` rotates the refresh token and returns a new access token.
- `POST /api/auth/logout` clears the cookie and invalidates the stored refresh-token hash.

### Forgot/reset password (demo)

1. `POST /api/auth/forgot-password` with `{ "email": "irfan@example.com" }`.
2. For this local demo, inspect the server terminal for the reset URL.
3. Copy its token and send:
```json
{
  "token": "TOKEN_FROM_SERVER_LOG",
  "newPassword": "Another_Strong_Password_456"
}
```
The reset token expires after 15 minutes and is stored hashed. A real deployment must send the link via an email provider and must not log it.

### RBAC

Register two accounts. Promote one account to admin:

```bash
node scripts/make-admin.js irfan@example.com
```

Use the admin access token:
- `GET /api/users`
- `PATCH /api/users/USER_ID/role` with `{ "role": "user" }` or `{ "role": "admin" }`

Never allow public registration to choose the `admin` role. The API explicitly assigns `user`.

## 5. Razorpay TEST integration

1. Create a Razorpay account and obtain TEST Key ID and Key Secret.
2. Put them in `.env`; never use live credentials while learning.
3. Set a webhook secret in the Razorpay dashboard and put the same value in `RAZORPAY_WEBHOOK_SECRET`.
4. Expose your local webhook endpoint with a trusted tunnel such as ngrok, then configure:
   `https://YOUR-TUNNEL/api/payments/webhook`
5. Subscribe to `payment.captured` and `payment.failed`.

Create order:
`POST /api/payments/orders`
```json
{ "amount": 50000 }
```
Amount is in paise: `50000` = ₹500. The server creates the order and saves a `created` payment record.

After the checkout client receives Razorpay's callback values, submit:
`POST /api/payments/verify`
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_from_checkout"
}
```

The server independently computes HMAC-SHA256 using the secret and compares signatures using `timingSafeEqual`.

Webhook:
- Uses `express.raw()` before JSON parsing because signature validation must use the exact raw request bytes.
- Verifies `x-razorpay-signature`.
- Updates the matching payment state.

Important: this sample demonstrates signature verification and guarded state updates. For production-grade idempotency, add a `WebhookEvent` collection with a unique index on Razorpay event ID, store each verified event transactionally, and make event processing retry-safe. Also fetch payment/order state from Razorpay when reconciliation is needed.

## 6. Test

```bash
npm test
```

The included test checks the health endpoint. Extend tests to cover:
- Registration validation and duplicate email
- Password hashing (never stored as plaintext)
- Login failure and success
- 401 without access token; 403 for non-admin
- Refresh-token rotation and logout invalidation
- Password-reset expiry and single use
- Invalid payment signatures and duplicate webhook delivery

## 7. Security decisions to explain

- Passwords are hashed with bcrypt cost factor 12; passwords are never stored in plaintext.
- Access tokens are short-lived; refresh tokens are stored in an HttpOnly cookie and only their SHA-256 hash is stored in MongoDB.
- Refresh-token rotation limits replay of an old refresh token.
- RBAC is enforced server-side through middleware; hiding a button in a UI is not authorization.
- Input validation reduces malformed/unexpected data.
- Helmet sets common security headers; rate limiting reduces repeated login attempts.
- Payment secrets remain server-side. The browser must never decide whether a payment succeeded.
- Webhook signatures are checked against the raw body.
- Use HTTPS, secure cookies, CSRF protection where cookie-authenticated state-changing routes require it, secret rotation, monitoring, backups, and a proper email provider before production.

## 8. Known learning-project limitations

- The refresh token is one active session per user; a production design may use a separate session collection to support multiple devices.
- Password reset email delivery is simulated by logging a local development URL.
- Add a persistent webhook event ledger with a unique event ID index for robust idempotency.
- Add stronger payment reconciliation and transaction-state transition rules before real-money use.
- No frontend checkout page is included; test the backend with Postman and Razorpay's test checkout sample.
- The sample has a small test suite; add controller and integration tests before claiming broad test coverage.

## 9. Suggested resume wording — use only after you build and test it

**Secure Authentication & Payment Management API**  
*Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, Razorpay Test Mode*
- Built REST APIs for user registration, login, refresh-token rotation, logout and password reset using Express.js.
- Implemented bcrypt password hashing, JWT authentication and server-side role-based authorization middleware.
- Designed MongoDB schemas with Mongoose for user accounts and payment transaction records.
- Integrated Razorpay test-mode order creation and server-side HMAC signature verification; implemented a signed webhook endpoint for payment status updates.
- Added request validation, rate limiting, centralized error handling and API tests.

Do not claim production deployment, live payments, or production-grade webhook idempotency unless you implement and verify those parts.
