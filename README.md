# ContentSage

Welcome to **Project Title**! This application is built with [Next.js](https://nextjs.org) and leverages [Supabase](https://supabase.com) for its backend. This README will guide you through setting up and running the project for the first time.

## Table of Contents

1. [Prerequisites](#prerequisites)  
2. [Project Structure](#project-structure)  
3. [Setup and Installation](#setup-and-installation)  
4. [Running the Next.js Development Server](#running-the-nextjs-development-server)  
5. [Supabase Migrations (GDPR Compliance)](#supabase-migrations-gdpr-compliance)  
6. [Building for Production](#building-for-production)  
7. [Running in Production Mode](#running-in-production-mode)  
8. [Deployment](#deployment)  
9. [Troubleshooting](#troubleshooting)  

---

## Prerequisites

1. **Node.js & npm**  
   - Ensure [Node.js](https://nodejs.org/) is installed (v16 or above recommended).
   - npm (or your preferred package manager) should be available.
   
2. **Git** (optional)  
   - Useful for version control but not strictly required.

3. **Supabase Service Role Keys**  
   - If you plan to run migrations, you’ll need valid Supabase credentials (Service Role Key) for both source and target projects (if migrating data).

---

## Project Structure

A high-level overview of the relevant directories:

```
.
├─ app/                     # Next.js App Router
│  └─ page.tsx             # Main Next.js page
├─ migrations/             # SQL migrations for GDPR, CCPA, etc.
├─ public/                  # Static files
├─ scripts/                 # Migration scripts (e.g., migrate-supabase.js, setup-new-supabase.js)
├─ styles/                  # Global styles (CSS/SCSS)
├─ .env                     # (example) Environment variables for your app
└─ README.md                # This file
```

Key directories and files:

- **migrations/**: Contains SQL files and instructions for GDPR and CCPA compliance.  
- **scripts/**: Includes JavaScript scripts to help automate Supabase migrations and setup.  
- **app/page.tsx**: Main page of the Next.js application.  
- **.env**: Store your environment variables here. (Never commit real secrets to version control!)

---

## Setup and Installation

1. **Clone this repository** (or download the ZIP):
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   ```
   Then change into the directory:
   ```bash
   cd your-repo-name
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   > Replace `npm` with `yarn` or `pnpm` if you prefer those package managers.

3. **Set up environment variables**:
   - Create a copy of any environment template file provided (e.g., `.env.example` or `.env.migration`) and rename it to `.env` (or `.env.local`) at the root of your project.  
   - Fill in the required fields (such as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

   **Example**:
   ```ini
   NEXT_PUBLIC_SUPABASE_URL="https://<project-id>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"
   SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
   ```

4. **(Optional) Additional environment configs for migrations**:  
   If you are migrating data (e.g., from a US-based Supabase project to a European project for GDPR compliance), you may have a separate `.env.migration.local` with fields like:
   ```ini
   SOURCE_SUPABASE_URL="https://your-source-project.supabase.co"
   SOURCE_SUPABASE_SERVICE_KEY="<source-project-service-role-key>"
   TARGET_SUPABASE_URL="https://your-target-project.supabase.co"
   TARGET_SUPABASE_SERVICE_KEY="<target-project-service-role-key>"
   ```

---

## Running the Next.js Development Server

Once dependencies and environment variables are in place, you can start the development server:

```bash
npm run dev
```

- This will start the Next.js dev server at [http://localhost:3000](http://localhost:3000).
- Any changes you make to the source will automatically reload.

---

## Supabase Migrations (GDPR Compliance)

This project includes scripts and SQL files to migrate schemas and data between different Supabase projects (e.g., from the US region to a European region for GDPR compliance).

1. **Install migration dependencies** (if not already installed):
   ```bash
   npm install dotenv @supabase/supabase-js
   ```

2. **Set up your migration environment** by creating or editing `.env.migration.local` (as noted in [Setup and Installation](#setup-and-installation)).

3. **Run the export script** to pull down existing schema and data:
   ```bash
   node migrate-supabase.js
   ```
   - This will create a `supabase-migration` directory with schema, data, and storage files.

4. **Set up your new Supabase project** (for instance, in a European region):
   ```bash
   node setup-new-supabase.js
   ```
   - This script will create tables, import data, and replicate storage bucket contents from the migration directory.

5. **Verify** the new project has all required tables, data, and configurations.

For more detailed instructions, refer to the project’s [MIGRATION-README.md](./MIGRATION-README.md) or relevant documentation in `migrations/` if provided.

---

## Building for Production

To create an optimized production build:

```bash
npm run build
```

This command compiles and bundles your project into the `.next` directory for efficient deployment.

---

## Running in Production Mode

After building, run:

```bash
npm run start
```

This will serve the optimized Next.js production build at [http://localhost:3000](http://localhost:3000).

---

## Deployment

Popular deployment options include:

1. **Vercel**:  
   - Connect your repository and Vercel will handle the build and deploy steps automatically.
2. **Self-Hosted or Other Platforms** (e.g., Docker, AWS, Heroku):  
   - Build locally with `npm run build`.  
   - Serve the `.next` directory in a Node environment with `npm run start`.

---

## Troubleshooting

- **Environment Variable Issues**: Make sure you have a valid `.env` file and that each key is in the correct place (e.g., `NEXT_PUBLIC_` prefix for variables used on the client side).
- **Migration Script Errors**: Check you have installed `@supabase/supabase-js` and set the correct source/target environment variables. Refer to the console output for specific error messages.
- **Supabase Permissions**: If you encounter permission errors, ensure you’re using the Service Role Key, not the public `anon` key, for migrations or admin operations.
- **RPC Function Errors** (e.g., `pgclient_execute`): Make sure the necessary functions exist in the new Supabase project. You may need to run a custom SQL migration or create the function manually in the SQL Editor.

If problems persist, consult [Supabase Docs](https://supabase.com/docs), [Next.js Docs](https://nextjs.org/docs), or inspect your scripts in the `scripts/` directory for further debugging.