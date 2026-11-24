# PollutionTracker API (Express + MongoDB)

## Setup
1. Install MongoDB locally, or create a free MongoDB Atlas cluster and copy its connection string.
2. `npm install`
3. Copy `.env.example` to `.env`; set `MONGODB_URI`, `JWT_SECRET` (16+ random chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. `npm run seed` (emission factors, admin account, sample reports/articles; safe to re-run)
5. `npm start` -> http://localhost:3000/api
6. Serve the frontend separately: `python -m http.server 8000`

## Logging in from reports.html (no login page yet)
Open the page, then paste in the browser console:

    fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:'ADMIN_EMAIL',password:'ADMIN_PASSWORD'})})
      .then(r=>r.json()).then(d=>{localStorage.setItem('token',d.token);location.reload()})

## Endpoints (all under /api)
| Area | Endpoint | Who |
|---|---|---|
| Auth | POST /auth/register, POST /auth/login, GET /auth/me | public / logged in |
| Reports | GET /reports, POST /reports, GET/PUT/DELETE /reports/:id | users: own only; admins: all (admins cannot PUT) |
| | PATCH /reports/:id/status `{status, statusReason}` | admin (reason required to reject) |
| Carbon | GET /carbon-logs/factors, GET /carbon-logs/summary, GET/POST /carbon-logs, PUT/DELETE /carbon-logs/:id | logged in, own logs |
| Articles | GET /articles, GET /articles/:id | public |
| | POST/PUT/DELETE /articles/:id | admin |
| | GET /articles/saved, PUT/DELETE /articles/:id/save | logged in |
| Feedback | POST /feedback | logged in |
| | GET /feedback, DELETE /feedback/:id | admin |
| Users | GET /users, DELETE /users/:id (also deletes their reports, logs, feedback) | admin |
| Dashboard | GET /dashboard/stats (alias /stat) | public, aggregates only |
| Uploads | POST /uploads/signature (Cloudinary signed upload) | logged in |

## Collections
users (role: user/admin), reports, carbonlogs, emissionfactors, articles, feedbacks.
