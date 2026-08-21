# Sri Lakshmi Mart — Admin & Business Management

A separate application from the customer website. It runs at
`billing.srilakshmimart.com` and shares one Supabase database with
`srilakshmimart.com`, so a price changed here is the price customers see.

The customer site in `srilakshmimart-v2/` was not modified by this work.

---

## 1. Project structure

```
admin/
  index.html            dashboard shell (auth-gated)
  login.html            sign-in

  css/
    base.css            design tokens, buttons, forms, chips
    layout.css          sidebar, header, drawers, modal, toasts
    components.css      cards, tables, filters, charts, page pieces

  js/
    config.js           ← your Supabase URL + anon key go here
    supabase.js         SDK wrapper; every call returns [data, error]
    db.js               the only module that knows table names
    demo-catalogue.js   real product list, used until Supabase is connected
    auth.js             sign in / out, password reset, route guard
    core.js             formatting, modals, toasts, CSV, printing
    charts.js           Chart.js, loaded on demand
    router.js           sidebar, notifications, hash routing
    pages/
      dashboard.js      summary cards, sales chart, recent activity
      orders.js         list, filters, detail, status workflow, bill print
      bills.js          bill history, date filters, print/export
      customers.js      list with computed totals, profile + history
      catalogue.js      products, inventory, categories
      insights.js       reports builder, analytics
      manage.js         offers, reviews, AI knowledge, settings

  sql/
    schema.sql          tables, views, triggers, RLS policies
    seed.sql            the real 97-product catalogue

  .env.example          which keys are public and which are not
```

**One rule worth keeping:** no page issues its own Supabase query. Everything
goes through `js/db.js`. That is what makes demo mode and the live database
interchangeable, and it means a table rename is a one-file change.

---

## 2. Supabase schema

16 tables with foreign keys, indexes and timestamps:

`admins` · `categories` · `products` · `product_variants` · `inventory` ·
`inventory_transactions` · `customers` · `orders` · `order_items` · `bills` ·
`payments` · `offers` · `reviews` · `notifications` · `business_settings` ·
`ai_knowledge`

Some decisions worth knowing about:

**Order lines copy the product name and price.** If you later rename a product
or change its price, old bills still show what the customer actually paid.

**Low stock is a SQL view, not a UI rule.** `inventory_status` derives
`available / low_stock / out_of_stock` from `stock` vs `minimum_stock`, so the
dashboard, the inventory page and any future report can never disagree.

**Offers expire on their own.** `offers_status` computes
`scheduled / active / expired` from the dates. There is no switch to remember
and no cron job to run.

**Stock movements are audited.** Every change goes through
`inventory_transactions`; a trigger updates the balance and raises a low-stock
notification. You can always answer "why is this number 12?".

**Order numbers come from the database** (`SLM-000001`), not the browser, so two
people billing at once cannot collide.

**Notifications are raised by triggers**, never invented by the interface.

### Row Level Security

Enabled on all 16 tables.

- **Staff** — full access, gated on `is_admin()`, which checks for an active row
  in `admins`. Being able to log in is not enough; you must be listed as an admin.
- **Public (the customer site)** — may read active products, variants, categories,
  approved reviews and live offers, and may create an order. Nothing else. It
  cannot read customers, bills, payments or other people's orders.

---

## 3. Setup

### a. Create the database

1. Create a project at [supabase.com](https://supabase.com) (the free tier is enough).
2. Open **SQL Editor** and run `sql/schema.sql`.
3. Run `sql/seed.sql` to load the real catalogue — 9 categories, 97 products,
   68 size variants. Opening stock is **0** for everything, deliberately: enter
   your real counts through Inventory → Stock In rather than inheriting numbers
   nobody verified.

### b. Create the first administrator

Supabase does not let you insert into `auth.users` directly, so:

1. **Authentication → Users → Add user**. Enter an email and password, and tick
   *Auto Confirm User*.
2. Copy the new user's UUID.
3. Run in the SQL editor:

```sql
insert into public.admins (user_id, full_name, email, role)
values ('PASTE-UUID-HERE', 'Praveen', 'you@example.com', 'owner');
```

Repeat for each staff member. Use `role = 'staff'` for limited users; the column
exists so you can tighten policies per role later.

### c. Point the app at your project

**Settings → API** in Supabase, then edit `js/config.js`:

```js
SUPABASE_URL:      'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...'
```

Only the **anon** key. Never the `service_role` key — it bypasses RLS entirely
and anyone can read a browser file.

---

## 4. Running it locally

No build step and no dependencies:

```bash
cd admin
python3 -m http.server 8080
```

Open `http://localhost:8080/login.html`.

Opening `index.html` from the filesystem will not work — Supabase auth needs a
real origin.

---

## 5. Demo mode

With `config.js` empty the app runs on sample data so the interface can be
reviewed before the backend exists. A yellow banner says so on every page, and
`DB.live()` is `false` throughout.

Products and categories are the **real** catalogue. Orders, customers and stock
levels are illustrative and disappear the moment Supabase is connected — they
exist only so tables, charts and empty states can be seen working.

Demo sign-in accepts any email. That is not a security hole in production
because it is unreachable once keys are present, but do not deploy publicly
without configuring Supabase first.

---

## 6. Deployment

Any static host works. Netlify, Vercel, Cloudflare Pages and GitHub Pages all
have free tiers that suit this.

**Netlify (drag and drop)**
1. netlify.com → *Add new site* → *Deploy manually*
2. Drop the `admin` folder in
3. *Site settings → Domain management → Add custom domain* → `billing.srilakshmimart.com`

**Cloudflare Pages** — connect the repository, set build command to *(none)* and
output directory to `admin`.

### Connecting billing.srilakshmimart.com

In whichever DNS provider holds `srilakshmimart.com`, add the record your host
gives you:

| Type | Name | Value |
|---|---|---|
| CNAME | `billing` | `your-site.netlify.app` |

If the DNS sits on Cloudflare, keep the record **DNS only** (grey cloud) during
setup so the host can issue its certificate, then re-enable the proxy if you want.

Propagation is usually minutes. HTTPS is issued automatically by every host above.

Finally, add `https://billing.srilakshmimart.com` to Supabase under
**Authentication → URL Configuration → Redirect URLs**, or password reset links
will fail.

---

## 7. Connecting the customer website

The storefront currently reads a local `js/data.js`. To share the database,
point its data layer at Supabase instead of that file — same anon key, and the
public read policies above already allow it. The important part is that the
admin app writes and the storefront reads **the same rows**. Do not create a
second product list.

Until that switch is made, the two are not yet synchronised; this application is
ready for it, the storefront is not.

---

## 8. Implemented

- Login with show/hide password, session persistence, password reset, route guard
- Collapsible sidebar, mobile drawer, 13 sections, active highlighting
- Dashboard: 8 summary figures, sales/orders chart with 4 ranges, recent orders,
  stock needing attention
- Orders: search, status/payment/date filters, detail view, 7-stage workflow,
  printable bill, WhatsApp contact with a generated message, CSV export
- Bills: history, quick ranges, custom dates, print, CSV export
- Customers: list with computed order counts and lifetime spend, profile with
  full order history, WhatsApp contact, CSV export
- Products: search, category filter, add/edit/delete, image, offer price,
  SKU, barcode, active toggle, CSV export
- Inventory: four summary cards, status filter, stock in/out with notes,
  running balance history, CSV export
- Categories with live product counts
- Offers: percentage or fixed, product or category, date window, automatic expiry
- Reviews: approve / hide, filtered by status — moderation only, never creation
- Reports: daily/weekly/monthly/yearly/custom, filters for status, payment and
  category, product and category breakdowns, CSV and print
- Analytics: sales trend, top products bar chart, category doughnut, ranked table
- AI Knowledge: eight sections, publish toggle, keywords — management only
- Settings: business details, order rules, password change, connection status
- Notifications from database triggers
- Responsive from 320px, keyboard accessible, reduced-motion aware,
  WCAG AA contrast throughout

## 9. Needs configuration before going live

1. **Supabase project** — create it, run both SQL files, add your keys
2. **First admin user** — section 3b; nobody can sign in until this row exists
3. **Real opening stock** — seeded at 0 on purpose
4. **Customer website integration** — section 7; not yet wired
5. **Payments** — methods and statuses are modelled, but no gateway is connected.
   COD and manual UPI work today; an online gateway is a separate piece of work.
6. **AI assistant** — the knowledge base is managed here, but no AI service is
   connected. The screen says so rather than implying otherwise.
7. **Email** — Supabase sends password resets on its own domain by default.
   Add SMTP if you want them from your own address.
8. **Backups** — the free tier keeps 7 days. Consider a scheduled export if you
   want longer.

---

## 10. Testing

145 automated tests cover the schema (tables, keys, indexes, RLS policies), the
absence of secrets in client code, routing across all 13 pages, dashboard
arithmetic against the underlying orders, the order status workflow, stock
movements and balances, offer expiry, report/chart totals agreeing with the
order data, accessibility, and WCAG AA contrast.

**Not verified:** I could not reach a real Supabase instance from this
environment, so authentication, RLS enforcement and live queries have not been
run against a live project. The demo path is fully exercised, and the Supabase
path is written against the documented API — but please test sign-in and one
write operation yourself immediately after setup, before relying on it.
