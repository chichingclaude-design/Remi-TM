# Database

The platform uses a single **SQLite** database at `data/ppm.db`, created automatically
on first launch from `backend/schema.sql`. It runs in WAL mode with foreign keys
enforced. There are **44 tables**, grouped below by domain.

To reset everything, stop the server and delete the `data/` folder — it is recreated
and re-seeded on the next launch.

## Identity, access & security

| Table              | Purpose                                                        |
|--------------------|----------------------------------------------------------------|
| `roles`            | Director / Manager / Specialist / Clerk with a numeric `level` |
| `permissions`      | Named permissions                                              |
| `role_permissions` | Role ↔ permission mapping                                      |
| `users`            | Accounts: credentials (hashed), profile, capacity, locale, theme |
| `sessions`         | Active bearer-token sessions with expiry                       |
| `teams`            | Delivery teams                                                 |
| `destinations`     | Business units / destinations                                  |
| `audit_logs`       | Append-only trail: actor, action, entity, timestamp, IP        |
| `notifications`    | Per-user in-app notifications                                  |
| `settings`         | Key/value application settings                                 |

## Portfolio & delivery

| Table                  | Purpose                                             |
|------------------------|-----------------------------------------------------|
| `portfolios`           | Top-level investment portfolios                     |
| `programs`             | Programs grouping related projects                  |
| `projects`             | Projects: budget, progress, health, priority, stage |
| `milestones`           | Project milestones with due dates and status        |
| `project_dependencies` | Finish-to-start style links between projects        |
| `stage_gates`          | Stage-gate checkpoints per project                  |
| `tasks`                | Work items; self-references `parent_task_id` for subtasks |
| `checklists`           | Checklist items belonging to a task                 |
| `task_dependencies`    | Links between tasks                                 |
| `time_entries`         | Logged hours (estimate vs actual)                   |
| `comments`             | Polymorphic comments (`entity_type` + `entity_id`)  |
| `documents`            | Attachment metadata                                 |

## Risk & change

| Table     | Purpose                                                    |
|-----------|------------------------------------------------------------|
| `risks`   | Risks scored by `probability × impact = severity`          |
| `issues`  | Raised issues                                              |
| `changes` | Change requests                                            |

## Workflow & governance

| Table                  | Purpose                                        |
|------------------------|------------------------------------------------|
| `workflows`            | Named workflows bound to an entity type        |
| `workflow_states`      | Ordered states with colour and initial/final flags |
| `workflow_transitions` | Allowed state-to-state transitions             |
| `automations`          | Trigger/condition/action automation rules      |
| `approvals`            | Approval requests and their decisions          |
| `raci_matrices`        | RACI matrices (optionally tied to a project)   |
| `raci_activities`      | Activities/rows within a matrix                |
| `raci_assignments`     | R/A/C/I letter per (activity, user)            |
| `sla_policies`         | Response/resolution targets by priority        |
| `sla_tickets`          | Tickets tracked against a policy, with breach flags |
| `sla_escalations`      | Escalation steps for breached tickets          |

## Strategy

| Table          | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `objectives`   | OKR objectives; self-references `parent_id`; `level` = company/department/team/individual |
| `key_results`  | Measurable key results rolling up to an objective          |
| `kpis`         | KPIs tagged by Balanced-Scorecard `perspective`            |
| `kpi_history`  | Time series of KPI values                                  |
| `scenarios`    | Saved what-if PPM scenarios                                |

## Resource management

| Table                   | Purpose                                        |
|-------------------------|------------------------------------------------|
| `resource_allocations`  | Percentage allocation of a user to a project   |
| `skills`                | Skill catalogue                                |
| `user_skills`           | Per-user skill proficiency levels              |

## Notes

- **Scoring.** `risks.severity` is stored as `probability × impact` (1–25). Project
  `priority_score` is computed by the PPM prioritisation endpoint and written back.
- **Roll-ups.** Updating a key result recomputes its parent objective's progress.
- **Polymorphism.** `comments` and some documents use an `entity_type` + `entity_id`
  pair so they can attach to tasks, projects, risks, etc.
- **Indexes.** Supporting indexes exist on the hot foreign keys (tasks, projects,
  time entries, comments, notifications, audit logs).

The authoritative definition is always `backend/schema.sql`.
