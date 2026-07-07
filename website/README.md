# Tamam Website

Marketing and landing site for Tamam — the digital health platform for hospitals and health systems everywhere, starting in South Sudan.

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0 ([download](https://nodejs.org))
- **npm** >= 9.0.0

Works on **Windows**, **macOS**, and **Linux**.

### Quick Start

```bash
cd website

# Interactive setup (installs deps, configures email)
npm run setup

# Or skip prompts and accept defaults
npm run setup:quick
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Manual Installation

```bash
cd website
npm install
cp .env.example .env.local
npm run dev
```

### Docker

From the project root:

```bash
docker compose up website
```

The website runs on port 3001.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing homepage
│   ├── layout.tsx                # Root layout (nav + footer)
│   ├── marketing.css             # Design system & styles
│   ├── about/                    # About, team, careers, contact
│   ├── ehr/                      # EHR features page
│   ├── billing/                  # Billing features page
│   ├── analytics/                # Analytics features page
│   ├── telehealth/               # Telehealth features page
│   ├── pharmacy-lab/             # Pharmacy & lab features page
│   ├── patient-experience/       # Patient portal features page
│   ├── pricing/                  # Pricing page
│   ├── donate/                   # Donation page
│   ├── resources/                # Blog, case studies, help center, API docs
│   ├── privacy/                  # Privacy policy
│   ├── terms/                    # Terms of service
│   └── api/
│       ├── contact/              # Contact form submissions
│       ├── demo-request/         # Demo request form
│       └── newsletter/           # Newsletter signups
├── components/
│   └── marketing/
│       ├── MarketingNav.tsx       # Navigation header
│       ├── MarketingFooter.tsx    # Footer with newsletter
│       └── MarketingShared.tsx    # Shared components (Reveal, FAQ, DemoForm)
├── lib/
│   └── request-utils.ts          # IP extraction for rate limiting
└── public/
    ├── assets/                   # Images, logos, photos
    └── icons/                    # App icons
```

## Environment Variables

All variables are optional. Without email configured, form submissions log to the console.

See `.env.example` for the full list.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Send emails via Resend |
| `SENDGRID_API_KEY` | Send emails via SendGrid (alternative) |
| `DEMO_FROM_EMAIL` | Sender email address |
| `DEMO_FROM_NAME` | Sender display name |
| `DEMO_NOTIFY_EMAIL` | Where form submissions are sent |
| `DEMO_SCHEDULING_URL` | Booking link included in demo request confirmations |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Interactive first-time setup |
| `npm run setup:quick` | Non-interactive setup with defaults |
| `npm run dev` | Start dev server on `localhost:3001` |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint |
