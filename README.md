# Synapse — Multi-Workspace Task Manager

Synapse is a high-performance, multi-tenant task management application built using **Next.js (App Router)**, **Supabase SSR**, and **TypeScript**. It features workspace-isolated security, real-time sync, optimistic UI updates, and an overdue task analysis edge function.

---

### Project Parameters & Timings
* **Start Time:** Tuesday, June 2, 2026, 7:10 PM (EAT / UTC+3)
* **Completion Time:** Wednesday, June 3, 2026, 7:00 PM (EAT / UTC+3)
* **Time Spent:** ~24 hours (Well within the 24-hour limit)

---

### Features Implemented & Working

1. **Authentication Flow (Sign Up, Sign In, Sign Out)**
   - Utilizes Supabase SSR client for secure server-side session management.
   - Next.js Middleware route protection forces guest users to `/login` or `/register` and redirects authenticated sessions to `/dashboard`.
   - Stateful login/registration screens with custom validation, visual loaders, and password toggles.

2. **Workspace-Isolated Schema & RLS Policies (R1)**
   - Custom written PostgreSQL schema in `schema.sql`.
   - RLS policies applied to all 4 operations (SELECT, INSERT, UPDATE, DELETE) across `workspaces`, `workspace_members`, `projects`, and `tasks`.
   - Data access is isolated based on member relationship inside `workspace_members` to prevent cross-workspace data leakage.
   - Secure database view `public.users` exposes only user IDs, emails, and full names of users who share a workspace with the active session.

3. **CLI Generated Types (R2)**
   - Uses Supabase database type definitions (`types/database.types.ts`).
   - Strictly typed code with 0 instances of `any` in the application code.

4. **Realtime Collaborative Sync (R3)**
   - Direct Supabase channel broadcast client listens for `postgres_changes` on tasks for the active `project_id`.
   - Triggers SWR cache re-validation instantly when status or field updates occur from other clients.
   - Cleans up database subscriptions on component unmount to prevent leaks.

5. **Dual URL-Synced Filters (R4)**
   - Filter state (Status & Assignee) is synchronized with URL search parameters.
   - Copy-pasting or sharing the link instantly loads the exact board filters and active project.

6. **Elegantly Designed Inline Field Editors & Project Rename (R5)**
   - Inline dropdowns, custom date pickers, and text inputs with clear save/cancel visual affordances.
   - Inline editing capability for active project names directly in the dashboard header.
   - Side panel details editor slide-in to edit long titles and descriptions without modal overlay shifts.

7. **Production Grade UX States (R6)**
   - High-fidelity visual skeleton loaders, blank-slate empty states with Calls to Action (CTAs), and full error recovery displays.

8. **Optimistic UI Updates (R7)**
   - Status updates are reflected immediately on the local task board.
   - If database update fails, state is rolled back and a warning toast/banner is displayed to the user.

9. **Supabase Edge Function: Overdue Tasks Report (R8)**
   - Custom Deno function written in `supabase/functions/overdue-tasks/index.ts`.
   - Securely parses user's JWT from headers to initialize client, ensuring RLS checks apply.
   - Returns overdue tasks with resolved assignee names which display directly in a reports panel inside the UI.

10. **Radix/Shadcn-style Calendar Date Picker**
    - Custom Calendar/Popover-based Date Picker created under `components/date-picker.tsx` matching Shadcn UI aesthetics, applied to task list view and detail view editing.

11. **Component Composition Architecture**
    - Decomposed the monolithic dashboard into modular components (`Sidebar`, `TaskBoard`, `TaskDetailPanel`, `OverdueReport`) for improved separation of concerns.

12. **Mobile Responsiveness**
    - Built responsive drawer layout for the Sidebar menu, with mobile menu toggle and viewport optimizations.

13. **Light/Dark Mode Theme Support**
    - Configured system-wide next-themes support with a persistent toggle switcher on the dashboard.

---

### Architectural Decisions

* **Secure Users View:** Supabase stores user records inside the `auth.users` schema which is protected by default. To display workspace member names/emails in dropdown lists securely, a secure PostgreSQL view `public.users` was designed. It checks membership overlap so a user can only read details of users sharing a workspace.
* **SWR Cache Isolation:** Separated SWR query hooks to maintain strict typescript types for `Workspace`, `Project`, and `Task` arrays rather than relying on a combined fetcher.
* **Central Environment Variables:** A central configuration helper (`utils/env.ts`) guarantees that the Next.js server fails immediately during start-up if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set.

---

### What is Incomplete, Skipped, or Broken — and Why

* **Incomplete / Broken:** None. All core requirements (R1–R6), optimistic UI (R7), and the Edge Function (R8) are fully implemented and functional.
* **Skipped (Email Confirmation Verification):** We intentionally disabled email confirmation requirement ("Confirm email" toggle set to OFF in Supabase dashboard under Authentication -> Providers -> Email).
  - *Why:* To allow evaluators to register any test email address on the live Vercel deployment and log in instantly without waiting for verification emails.
* **Skipped (Third-party OAuth):** Focused strictly on the core email/password signup and login flow.

---

### How to Run Locally

Get the application up and running in **3 simple commands or fewer**:

1. **Install Dependencies & Setup Env File:**
   * **For macOS / Linux (Bash / Zsh):**
     ```bash
     npm install && cp .env.example .env.local
     ```
   * **For Windows (PowerShell):**
     ```powershell
     npm install; Copy-Item .env.example .env.local
     ```
   * **For Windows (Command Prompt - CMD):**
     ```cmd
     npm install && copy .env.example .env.local
     ```
   *(Note: Remember to open `.env.local` and paste your Supabase URL & Anon Key)*

2. **Seed Database Schema:**
   * Run the schema file against your linked remote Supabase project:
     ```bash
     npx supabase db query --file schema.sql --linked
     ```
   * *Alternatively*, copy the contents of `schema.sql` and run them inside the **SQL Editor** of your Supabase project dashboard.

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

---

### Supabase CLI & Edge Function Deployment

To deploy or link the Supabase Edge function and database config, run these commands:

1. **Login to Supabase CLI:**
   ```bash
   npx supabase login
   ```
2. **Link local codebase to your Supabase Project:**
   ```bash
   npx supabase link --project-ref [YOUR_PROJECT_REF]
   ```
   *Replace `[YOUR_PROJECT_REF]` with your actual Supabase Project ID (available in your project's URL).

3. **Deploy the Overdue Tasks Edge Function:**
   ```bash
   npx supabase functions deploy overdue-tasks
   ```
