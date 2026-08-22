# EnContract — Contract & Compliance Manager

A web app where users upload contract PDFs, save them into workspaces, and get an AI-powered dashboard with risk/clause charts, a compliance checklist, deadlines, and a chat assistant. **No mock/demo PDFs anywhere — everything starts from empty states.**

## Step 0 — Design directions (first action after approval)

No visual direction was specified, so the first build step is generating 3 rendered design directions (color, typography, layout, motion style) for you to pick from. The chosen direction then drives the whole app's look.

## Features

### 1. Splash / welcome animation
- App loads with a quick fade-in "pop" splash showing the EnContract logo, then smoothly transitions to the landing page. Returning signed-in users skip past it into their dashboard.

### 2. Authentication
- Public `/auth` page with:
  - **Sign in with Google** (fully managed, works immediately).
  - **Email** sign-in (email OTP).
  - **Sign in with Phone Number** with a full OTP input flow (enter phone → receive code → 6-digit OTP input). Phone SMS requires a provider (e.g. Twilio) — the UI and flow will be complete; it activates once SMS provider credentials are added in settings, and I'll flag this in the UI gracefully if not configured.
- Returning users with an active session are routed straight to their workspace dashboard.
- Basic profiles: display name + avatar stored in a `profiles` table, auto-created on signup, shown in the dashboard header.


