# Verification & Testing Suite

## 1. Automated Verification Suite (`npm run verify`)

The project includes an automated end-to-end audit and test runner located at `backend/scripts/verify-system.ts`.

### Running the Suite
```bash
cd backend
npm run verify
```

### Verification Matrix & Criteria

```
================================================================================
   🚀 REACHINBOX SCHEDULER: COMPREHENSIVE SYSTEM VERIFICATION SUITE
================================================================================

--------------------------------------------------------------------------------
| Status | Test Case                                              | Duration   |
--------------------------------------------------------------------------------
| ✅ PASS | Test 1: Zero-Cron Architecture Audit                   |        4ms |
| ✅ PASS | Test 2: BullMQ Delayed Job Scheduling                  |        0ms |
| ✅ PASS | Test 3: Hourly Rate Limit & Non-Destructive Rescheduling |        1ms |
| ✅ PASS | Test 4: Idempotency & Duplicate-Send Protection        |        0ms |
--------------------------------------------------------------------------------
```

---

## 2. Test Cases Breakdown

### Test 1: Zero-Cron Architecture Audit
- **Goal**: Formally audit that no forbidden cron or interval-polling mechanisms exist.
- **Process**:
  1. Inspects `backend/package.json` for banned packages (`node-cron`, `cron`, `agenda`, `node-schedule`, `bree`).
  2. Recursively scans all `.ts` and `.js` source files in `backend/src/` for cron import statements or `cron.schedule()` patterns.
- **Result**: Confirms 0 cron dependencies and 0 cron scheduling loops.

### Test 2: BullMQ Delayed Job Scheduling
- **Goal**: Verify precision scheduling semantics using BullMQ delayed jobs.
- **Process**:
  1. Schedules a job 5,000ms into the future.
  2. Verifies the calculated delay score falls within strict bounds.
  3. Verifies initial state is `SCHEDULED` and target state transitions to `SENT` with an Ethereal preview URL upon delay expiration.

### Test 3: Hourly Rate Limit & Non-Destructive Rescheduling
- **Goal**: Verify that when a sender hits their hourly limit, excess jobs are neither dropped nor marked as failed, but instead staggered into the next hour.
- **Process**:
  1. Enqueues a batch of **15 emails** for a sender with `hourlyLimit = 5` and `delayBetweenEmailsMs = 500ms`.
  2. Executes the exact atomic Redis Lua algorithm.
  3. Asserts that exactly **5 emails** are sent (`ALLOWED`) in the current hour window.
  4. Asserts that the remaining **10 emails** are `RESCHEDULED` to the next hour window, staggered cleanly by `500ms` spacing.
  5. Asserts 0 emails were dropped or failed.

### Test 4: Idempotency & Duplicate-Send Protection
- **Goal**: Prove that crashing or restarting mid-batch never double-sends already completed emails.
- **Process**:
  1. Simulates an `EmailJob` already in `SENT` status in the database.
  2. Passes the job to the worker processor.
  3. Asserts the worker intercepts the job at the Idempotency Guard, returns `{ skipped: true, reason: 'Job already sent' }`, and prevents any outbound SMTP dispatch.

---

## 3. Python Automation & Tooling Setup

A dedicated Python virtual environment is included in the project root for API testing, automation, and load simulation.

### Activating the Environment
```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows Command Prompt
.\venv\Scripts\activate.bat

# Linux / macOS
source venv/bin/activate
```

### Python Dependencies (`requirements.txt`)
- `requests` & `httpx`: High-speed synchronous and asynchronous HTTP client libraries.
- `pydantic`: Schema modeling and response validation.
- `pytest` & `pytest-asyncio`: Automated test runner.
- `python-dotenv`: Environment variable loader.
- `redis`: Direct Redis key inspection and Lua script validation.
- `rich`: Beautiful formatted terminal tables and diagnostics.
