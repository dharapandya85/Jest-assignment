# Salon API - Jest Automation Suite

Jest-based API automation for the salon booking application. The suite covers authentication, authorization, booking business rules, negative scenarios, and the complete end-to-end workflow:

**Register → Login → Booking → Cancel**

## Prerequisites

- Node.js **20 or later** (Node.js 22 LTS is recommended).
- npm 10+.
- MongoDB running locally or a reachable MongoDB instance.
- The repository's existing TypeScript/Express application dependencies.

## Dependencies

The application uses:

- Express
- MongoDB/Mongoose
- JWT authentication
- bcryptjs
- dotenv
- TypeScript

The automation suite adds:

- **Jest** for test execution.
- Node.js built-in `fetch` for HTTP requests, so no additional HTTP client is required.

## Environment Setup

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb://localhost:27017/salon-db
JWT_SECRET=change-this-development-secret
PORT=3000
```

An example file is provided as `.env.example`.

### MongoDB

The application requires MongoDB. The default configuration is:

```text
mongodb://localhost:27017/salon-db
```

You can replace `MONGO_URI` with a MongoDB Atlas connection string or another MongoDB instance.

### Seed data

The booking tests require the seeded salon, service, and stylist records. Seed the database before running the tests:

```bash
npm run seed
```

**Warning:** the seed script clears the existing users, salons, services, and bookings in the configured database before recreating the sample data.

The seeded data includes:

- Salon: `Elegant Beauty Salon`
- Service: `Men Haircut`
- Two stylist accounts
- An admin account

The tests create their own customer accounts with unique email addresses, so they do not depend on fixed customer credentials.

## Installation

Install dependencies:

```bash
npm install
```

The Jest dependency is declared in `package.json`.

## Run Tests

Make sure MongoDB is running and the database has been seeded:

```bash
npm run seed
npm test
```

`npm test` performs the following automatically:

1. Compiles the TypeScript application into `dist/`.
2. Starts the compiled API on port `3100` for the test run.
3. Runs Jest serially with `--runInBand`.
4. Connects to the configured MongoDB database to locate the seeded salon/service/stylist fixtures.
5. Terminates the test API process after the suite completes.

You can also run Jest directly after building:

```bash
npm run build
npx jest --runInBand
```

For watch mode:

```bash
npm run test:watch
```

## Test Configuration

The test suite is located at:

```text
tests/
├── api.e2e.test.js
└── helpers/
    ├── api.js
    └── db.js
```

### `tests/helpers/api.js`

Contains reusable API utilities:

- HTTP request wrapper
- Authorization header creation
- Unique test-user generation
- Base URL configuration

### `tests/helpers/db.js`

Connects to MongoDB only for test fixture discovery. It reads the seeded salon, service, and stylist IDs so the API tests do not hard-code MongoDB ObjectIds.

### `tests/api.e2e.test.js`

Contains the actual Jest API scenarios.

## Automated Scenarios

### Authentication - positive

- Register a new customer.
- Login using valid credentials.
- Validate JWT, role, and user ID in the login response.

### Authentication - negative

- Duplicate registration.
- Invalid login password.

### Authorization / security

- Booking without authentication returns `401`.
- Booking with an invalid JWT returns `401`.
- A customer cannot cancel another customer's booking and receives `403`.
- The booking owner can cancel their own booking.

### Booking - positive

- Retrieve available slots.
- Create a valid booking.
- Validate booking IDs and returned booking fields.
- Validate calculated `endTime` format.
- Cancel a valid booking.

### Booking - negative / business rules

- Missing date returns `400`.
- Unknown service returns `404`.
- Conflicting booking for the same stylist/time returns `400`.
- Cancelling an already cancelled booking returns `400`.
- Cancelling a nonexistent booking returns `404`.
- Missing available-slot query parameters returns `400`.

### End-to-end workflow

One test explicitly executes the full workflow:

```text
Register
   ↓
Login
   ↓
Get available slot
   ↓
Create booking
   ↓
Cancel booking
```

## Setup and Teardown

The Jest suite starts the compiled API automatically in `beforeAll` and stops that process in `afterAll`.

The test suite does **not** automatically seed or wipe the database because doing so inside every test run could destroy developer data. Run `npm run seed` against a dedicated test/development MongoDB database before testing.

Test users are generated with unique email addresses on every run.

## Assumptions

1. MongoDB is available before `npm test` starts.
2. The configured database contains the seed data created by `npm run seed`.
3. The application uses the default JWT secret unless `JWT_SECRET` is supplied.
4. Node.js 20+ is available, which provides the built-in `fetch` API used by the tests.
5. Port `3100` is available for the temporary API process used by Jest.
6. The `available-slots` endpoint is intentionally tested without authentication because the current API does not protect that route.
7. The application currently allows self-registration only as a `customer`; the tests therefore create customer accounts through `/api/register`.
8. The tests use future dates (`2030-01-15` through `2030-01-18`) to avoid collisions with existing appointment data.

## Project Structure

```text
.
├── app.ts
├── index.ts
├── controllers/
├── middleware/
├── models/
├── routes/
├── utils/
├── tests/
│   ├── api.e2e.test.js
│   └── helpers/
│       ├── api.js
│       └── db.js
├── .env.example
├── package.json
├── package-lock.json
└── tsconfig.json
```

## Notes

The Express application is separated into `app.ts` and `index.ts` so the HTTP application and server startup are clearly separated. This makes the API easier to automate and avoids coupling the Jest suite to application startup logic.
