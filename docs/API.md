# API Reference

All endpoints are served under `http://127.0.0.1:8000`. Requests and responses are
JSON. Every endpoint except `POST /api/auth/login` requires an
`Authorization: Bearer <token>` header obtained from login.

Errors are returned as `{ "error": "message" }` with an appropriate HTTP status
(`400`, `401`, `403`, `404`).

## Authentication

| Method | Path               | Description                                  | Min role |
|--------|--------------------|----------------------------------------------|----------|
| POST   | `/api/auth/login`  | Exchange username/password for a token       | —        |
| POST   | `/api/auth/logout` | Invalidate the current session               | any      |
| GET    | `/api/me`          | Current user profile                         | any      |
| PUT    | `/api/me/prefs`    | Update `locale` and/or `theme`               | any      |

`POST /api/auth/login` body: `{ "username": "...", "password": "..." }` →
`{ "token": "...", "user": { ... } }`.

## Reference data

| Method | Path                | Description        | Min role |
|--------|---------------------|--------------------|----------|
| GET    | `/api/users`        | All users          | any      |
| POST   | `/api/users`        | Create a user (enforces password policy) | Director |
| PUT    | `/api/users/{id}`   | Edit user / reset password / activate-deactivate | Director |
| GET    | `/api/teams`        | All teams          | any      |
| GET    | `/api/destinations` | Business units     | any      |
| GET    | `/api/roles`        | Roles              | any      |

**Password policy** (enforced server-side on create and on password reset): at least
12 characters, including an uppercase letter, a lowercase letter, a number and a
special character. Non-compliant passwords are rejected with `400`.

## Portfolios & projects

| Method | Path                    | Description                              | Min role |
|--------|-------------------------|------------------------------------------|----------|
| GET    | `/api/portfolios`       | Portfolios (scoped)                      | any      |
| GET    | `/api/programs`         | Programs (scoped)                        | any      |
| GET    | `/api/projects`         | Projects (scoped; `?status=&portfolio_id=`) | any   |
| POST   | `/api/projects`         | Create a project                         | Manager  |
| GET    | `/api/projects/{id}`    | Project detail (milestones, risks, team) | any      |
| PUT    | `/api/projects/{id}`    | Update a project                         | Manager  |
| DELETE | `/api/projects/{id}`    | Delete a project                         | Manager  |

## Tasks

| Method | Path                          | Description                                  | Min role   |
|--------|-------------------------------|----------------------------------------------|------------|
| GET    | `/api/tasks`                  | Tasks (`?project_id=&status=&mine=&assignee_id=`) | any   |
| POST   | `/api/tasks`                  | Create a task                                | Specialist |
| GET    | `/api/tasks/{id}`             | Task detail (checklist, comments)            | any        |
| PUT    | `/api/tasks/{id}`             | Update a task                                | assignee+  |
| DELETE | `/api/tasks/{id}`             | Delete a task                                | Manager    |
| PUT    | `/api/tasks/{id}/status`      | Move task (Kanban)                           | assignee+  |
| POST   | `/api/tasks/{id}/checklist`   | Add checklist item                           | assignee+  |
| PUT    | `/api/checklist/{id}`         | Toggle checklist item                        | assignee+  |
| POST   | `/api/tasks/{id}/comments`    | Add a comment                                | assignee+  |
| POST   | `/api/tasks/{id}/time`        | Log time                                     | assignee+  |

## Risks

| Method | Path         | Description          |
|--------|--------------|----------------------|
| GET    | `/api/risks` | Risks (scoped)       |

## OKR & KPI

| Method | Path                          | Description                       |
|--------|-------------------------------|-----------------------------------|
| GET    | `/api/okrs`                   | Objective tree with key results   |
| PUT    | `/api/key_results/{id}`       | Update a key result (rolls up)    |
| GET    | `/api/kpis`                   | KPIs (Balanced Scorecard)         |
| GET    | `/api/kpis/{id}/history`      | KPI history series                |

## SLA

| Method | Path                  | Description        |
|--------|-----------------------|--------------------|
| GET    | `/api/sla/policies`   | SLA policies       |
| GET    | `/api/sla/tickets`    | SLA tickets        |

## RACI

| Method | Path               | Description                                   |
|--------|--------------------|-----------------------------------------------|
| GET    | `/api/raci`        | RACI matrices                                 |
| GET    | `/api/raci/{id}`   | Matrix detail with assignments + validation   |

## Resources

| Method | Path                             | Description                               |
|--------|----------------------------------|-------------------------------------------|
| GET    | `/api/resources/utilization`     | Per-person allocation & status            |
| GET    | `/api/resources/skills`          | Skills matrix grid                        |
| GET    | `/api/resources/suggestions`     | Heuristic resource-balancing suggestions  |

## Workflow & approvals

| Method | Path                     | Description                     | Min role |
|--------|--------------------------|---------------------------------|----------|
| GET    | `/api/workflows`         | Workflows with states/transitions | any    |
| GET    | `/api/automations`       | Automation rules                | any      |
| GET    | `/api/approvals`         | Approval requests               | any      |
| PUT    | `/api/approvals/{id}`    | Approve / reject                | Manager  |

## Notifications

| Method | Path                              | Description            |
|--------|-----------------------------------|------------------------|
| GET    | `/api/notifications`              | Current user's notifications |
| PUT    | `/api/notifications/{id}/read`    | Mark as read           |

## Analytics dashboards

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/api/dashboard/executive`    | Executive summary               |
| GET    | `/api/dashboard/portfolio`    | Portfolio breakdown + bubble    |
| GET    | `/api/dashboard/resource`     | Utilisation & allocation        |
| GET    | `/api/dashboard/project?id=`  | Single project dashboard        |
| GET    | `/api/dashboard/risk`         | Risk heatmap + top risks        |
| GET    | `/api/dashboard/financial`    | Cost by portfolio, overruns     |
| GET    | `/api/dashboard/okr`          | Objectives progress             |
| GET    | `/api/dashboard/kpi`          | Balanced Scorecard              |

## PPM

| Method | Path                          | Description                          | Min role |
|--------|-------------------------------|--------------------------------------|----------|
| GET    | `/api/ppm/prioritization`     | Ranked projects by value/risk score  | any      |
| GET    | `/api/ppm/capacity`           | Demand vs capacity by team           | any      |
| POST   | `/api/ppm/scenario`           | What-if funding (`budget_cap`, `fund_top`) | Manager |
| GET    | `/api/ppm/health`             | Portfolio Health Score               | any      |

## Administration

| Method | Path                       | Description                | Min role |
|--------|----------------------------|----------------------------|----------|
| GET    | `/api/audit`               | Audit trail (last 200)     | Manager  |
| GET    | `/api/settings`            | Application settings        | any      |
| PUT    | `/api/settings`            | Update settings             | Director |
| GET    | `/api/backups`             | List database backups       | Director |
| POST   | `/api/backups`             | Create a backup             | Director |
| POST   | `/api/backups/restore`     | Restore a backup (`name`)   | Director |

> "assignee+" means the assigned specialist may act on their own task, and any
> Manager or Director may act on any task within their scope.
