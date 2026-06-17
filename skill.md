# SMJ Golf Academy Booking App - Project Skills & Conventions

This document serves as the AI/Developer guide (`skill.md`) for the SMJ Golf Academy Booking Application. It outlines the technology stack, architectural decisions, security paradigms, and design guidelines for the project.

## Technology Stack
- **Frontend**: Pure HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+).
- **Backend**: PHP 8.x (Procedural).
- **Database**: MySQL (via `mysqli`).
- **Authentication**: Clerk (Frontend JS SDK + Backend JWT Verification).
- **Payments**: Paystack API (Inline Checkout + Backend Verification).

## Architecture & Security Paridigms

### 1. Authentication & API Flow
- **Strict JWT Verification**: The backend does NOT trust the frontend. Every protected API request must pass through `api/verify_auth.php`.
- **Clerk Integration**: Do not use standard `fetch()` for internal API requests. **ALWAYS** use the global wrapper `window.apiFetch('api/endpoint.php')`. This wrapper automatically retrieves the active Clerk JWT and injects it into the `Authorization: Bearer <token>` header.
- **Admin Authorization**: Admin privileges are managed via Clerk's Public Metadata (`"role": "admin"`). In PHP, use `$auth = verifyAuth(true);` to enforce admin-only access.
- **Data Ownership**: For standard users, always forcefully override payload user IDs with the server-verified `$auth['user_id']` to prevent ID-spoofing vulnerabilities.

### 2. Backend Conventions
- **Routing**: Procedural PHP files act as endpoints (e.g., `api/bookings.php`, `api/settings.php`). Each file switches on `$_SERVER['REQUEST_METHOD']` (GET, POST, PUT, DELETE).
- **Database**: Use Prepared Statements (`$conn->prepare()`) for all SQL queries to prevent SQL injection.
- **Responses**: Always return standard JSON objects: `echo json_encode(["status" => "success|error", "message" => "..."]);`

### 3. Frontend Conventions
- **No Frameworks**: The application is built without React/Vue. State is managed via local variables and DOM manipulation.
- **Modals & Overlays**: Use custom HTML/CSS modals (`.modal-overlay`, `.modal-content`). 
- **Global Objects**: Important utilities are attached to the `window` object (e.g., `window.apiFetch`, `window.showToaster`).

## Design System (Brutalist UI)
The application strictly follows a Modern Brutalist design aesthetic. Whenever modifying or creating new UI elements, adhere strictly to these rules:

1. **Typography**: 
   - Use `Space Grotesk` for all text.
   - Use uppercase text (`text-transform: uppercase`) aggressively for headers, buttons, and tags.
   - **Do NOT** use `font-weight > 400` or bold tags on the admin dashboard pages to maintain the established clean UI.
2. **Colors & Contrast**:
   - High contrast is mandatory. Use stark black (`#000000`) and pure white (`#ffffff`).
   - Accent colors (like Neo-green) should be used sparingly for primary actions.
3. **Borders & Shadows**:
   - Use thick, solid borders (`border: 2px solid var(--text-dark)`).
   - Use hard, offset box-shadows (`box-shadow: 4px 4px 0 var(--text-dark)`) instead of soft blur shadows to maintain the brutalist feel.
4. **Responsiveness**:
   - The application must remain 100% responsive. Use Flexbox and CSS Grid extensively.

## Key Directories & Files
- `/api/` - Contains all PHP backend logic.
- `/assets/` - Contains images and icons.
- `index.html` / `main.js` - Customer facing landing page and booking flows.
- `admin.html` / `admin.js` - Administrator dashboard for managing users and bookings.
- `lessons.html` / `lessons.js` - User portal for viewing and managing their scheduled lessons.
- `style.css` - Global stylesheet containing all CSS variables and design tokens.
