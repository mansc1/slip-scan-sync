# Redesign `/auth` as Landing Page + Separate Admin Login

## Overview

Transform `/auth` from a back-office login screen into a user-facing landing page. Move admin login to `/admin/login`. Update routing accordingly.

## Changes

### 1. New `/auth` Landing Page (`src/pages/Auth.tsx` — rewrite)

Structure:

- **Hero**: SlipSync logo/icon, tagline "บันทึกรายจ่ายจากสลิปอัตโนมัติผ่าน LINE", supporting text about the 3-step flow
- **New User Section** ("ผู้ใช้งานใหม่"):
  - 3-step visual: เพิ่มเพื่อน → ส่งสลิป → ดู Dashboard
  - CTA: "เริ่มใช้งานผ่าน LINE" button linking to LINE Official Account add-friend URL
  - QR code placeholder area (visible on desktop, hidden on mobile where the button is primary)
- **Existing User Section** ("ผู้ใช้งานเดิม"):
  - "เปิด My Dashboard" → navigates to `/liff/dashboard`
  - "เปิด LINE bot" → links to LINE OA chat
- **Footer**: small "สำหรับผู้ดูแลระบบ" text link → `/admin/login`
- Mobile-first, clean layout, no admin form visible

### 2. New Admin Login Page (`src/pages/AdminLogin.tsx` — new file)

- Move the existing email/password form here
- Title: "SlipSync Admin"
- Same Supabase auth logic (signInWithPassword / signUp)
- No LINE login button
- Back link to `/auth`

### 3. Routing Updates (`src/App.tsx`)

- `/auth` → landing page (no `AuthRoute` guard needed — it's public, but redirect authenticated admins to `/`)
- `/admin/login` → `AdminLogin` wrapped in `AuthRoute` (redirect if already logged in)
- `ProtectedRoute` redirect target stays `/auth` (landing page)

### 4. LINE OA Configuration

- Will use placeholder QR code image and LINE OA URL. The user can replace the QR image and URL with their actual LINE Official Account details.
- LINE OA add-friend URL format: `https://line.me/R/ti/p/@{LINE_OA_ID}` — will add a config constant.

## Files


| File                       | Action                                   |
| -------------------------- | ---------------------------------------- |
| `src/pages/Auth.tsx`       | Rewrite as landing page                  |
| `src/pages/AdminLogin.tsx` | New — admin email/password login         |
| `src/App.tsx`              | Add `/admin/login` route, update imports |
| `src/config/liff.ts`       | Add LINE OA URL constant                 |


## Technical Notes

- No database changes needed
- No edge function changes
- Admin auth logic unchanged, just relocated
- `AuthRoute` wrapper on `/admin/login` prevents double-login
- Landing page is fully public — no auth guard  


Also make sure admin-only routes redirect to `/admin/login`, while general unauthenticated user-facing routes remain on `/auth`.