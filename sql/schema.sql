-- ============================================================
-- SRI LAKSHMI MART — ADMIN & BUSINESS MANAGEMENT
-- Supabase schema
--
-- Run this once in the Supabase SQL editor.
-- Safe to re-run: every object is created with IF NOT EXISTS.
--
-- This is the single source of truth for BOTH
--   srilakshmimart.com          (customer site)
--   billing.srilakshmimart.com  (this admin app)
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- helpers
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Is the caller a staff member? Used by every admin-only policy.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and is_active = true
  );
$$;

-- ------------------------------------------------------------
-- admins  (maps a Supabase auth user to a staff role)
-- ------------------------------------------------------------
create table if not exists public.admins (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null default 'staff'
              check (role in ('owner','manager','staff')),
  is_active   boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists admins_user_idx on public.admins(user_id);

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  description text,
  image_url   text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default uuid_generate_v4(),
  sku           text unique,
  barcode       text,
  slug          text not null unique,
  name          text not null,
  category_id   uuid references public.categories(id) on delete set null,
  description   text,
  benefits      text[],
  how_to_use    text,
  -- base price; per-size prices live in product_variants
  price         numeric(10,2) not null check (price >= 0),
  offer_price   numeric(10,2) check (offer_price >= 0),
  image_url     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx   on public.products(is_active);

-- ------------------------------------------------------------
-- product_variants  (200g / 500g / 1kg …)
-- ------------------------------------------------------------
create table if not exists public.product_variants (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references public.products(id) on delete cascade,
  label       text not null,                 -- '500g'
  grams       int,                           -- 500, for sorting
  price       numeric(10,2) not null check (price >= 0),
  sku         text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (product_id, label)
);
create index if not exists variants_product_idx on public.product_variants(product_id);

-- ------------------------------------------------------------
-- inventory  (one row per product/variant)
-- ------------------------------------------------------------
create table if not exists public.inventory (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references public.products(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete cascade,
  stock         int not null default 0,
  minimum_stock int not null default 10,
  updated_at    timestamptz not null default now(),
  unique (product_id, variant_id)
);
create index if not exists inventory_product_idx on public.inventory(product_id);

-- derived status, so "low stock" is defined in one place only
create or replace view public.inventory_status as
select i.*,
       p.name as product_name,
       v.label as variant_label,
       case when i.stock <= 0 then 'out_of_stock'
            when i.stock <= i.minimum_stock then 'low_stock'
            else 'available' end as status
from public.inventory i
join public.products p on p.id = i.product_id
left join public.product_variants v on v.id = i.variant_id;

-- ------------------------------------------------------------
-- inventory_transactions  (audit trail for every stock move)
-- ------------------------------------------------------------
create table if not exists public.inventory_transactions (
  id           uuid primary key default uuid_generate_v4(),
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete set null,
  kind         text not null check (kind in ('stock_in','stock_out','adjustment','order','return')),
  quantity     int  not null,                -- signed: +20 in, -5 out
  balance_after int,
  reference    text,                         -- order number, invoice, note
  note         text,
  created_by   uuid references public.admins(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists inv_tx_product_idx on public.inventory_transactions(product_id, created_at desc);

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default uuid_generate_v4(),
  phone       text not null unique,          -- the natural key for this business
  full_name   text not null,
  email       text,
  address     text,
  city        text,
  pincode     text,
  state       text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists customers_phone_idx on public.customers(phone);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default uuid_generate_v4(),
  order_number    text not null unique,      -- SLM-000125
  customer_id     uuid references public.customers(id) on delete set null,
  -- captured at order time so history survives a customer edit
  customer_name   text not null,
  customer_phone  text not null,
  delivery_address text,
  status          text not null default 'new'
                  check (status in ('new','confirmed','processing','packed',
                                    'shipped','delivered','cancelled')),
  payment_method  text not null default 'cod'
                  check (payment_method in ('cod','upi','online','other')),
  payment_status  text not null default 'pending'
                  check (payment_status in ('pending','paid','failed','refunded')),
  subtotal        numeric(10,2) not null default 0,
  discount        numeric(10,2) not null default 0,
  delivery_charge numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  source          text default 'website',    -- website | whatsapp | counter
  note            text,
  placed_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_placed_idx   on public.orders(placed_at desc);
create index if not exists orders_status_idx   on public.orders(status);
create index if not exists orders_customer_idx on public.orders(customer_id);

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  variant_id   uuid references public.product_variants(id) on delete set null,
  -- names and prices are copied so an old bill never changes
  product_name text not null,
  variant_label text,
  unit_price   numeric(10,2) not null,
  quantity     int not null check (quantity > 0),
  subtotal     numeric(10,2) not null,
  created_at   timestamptz not null default now()
);
create index if not exists order_items_order_idx   on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

-- ------------------------------------------------------------
-- bills
-- ------------------------------------------------------------
create table if not exists public.bills (
  id           uuid primary key default uuid_generate_v4(),
  bill_number  text not null unique,         -- SLB-000125
  order_id     uuid not null references public.orders(id) on delete cascade,
  amount       numeric(10,2) not null,
  status       text not null default 'issued'
               check (status in ('issued','paid','cancelled','refunded')),
  issued_at    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists bills_issued_idx on public.bills(issued_at desc);

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
create table if not exists public.payments (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  method     text not null check (method in ('cod','upi','online','other')),
  status     text not null default 'pending'
             check (status in ('pending','paid','failed','refunded')),
  amount     numeric(10,2) not null,
  reference  text,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- offers
-- ------------------------------------------------------------
create table if not exists public.offers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  product_id    uuid references public.products(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete cascade,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  starts_on     date not null,
  ends_on       date not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- An offer is live only inside its window; expiry needs no cron job.
create or replace view public.offers_status as
select o.*,
       case when not o.is_active then 'disabled'
            when current_date < o.starts_on then 'scheduled'
            when current_date > o.ends_on   then 'expired'
            else 'active' end as computed_status
from public.offers o;

-- ------------------------------------------------------------
-- reviews  (written by customers; admin only moderates)
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid references public.products(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  customer_name text not null,
  location      text,
  rating        int  not null check (rating between 1 and 5),
  body          text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reviews_status_idx on public.reviews(status);

-- ------------------------------------------------------------
-- notifications  (raised by triggers, never invented by the UI)
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  kind       text not null check (kind in ('new_order','low_stock','out_of_stock','new_review')),
  title      text not null,
  body       text,
  entity_id  uuid,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_unread_idx on public.notifications(is_read, created_at desc);

-- ------------------------------------------------------------
-- business_settings  (single row)
-- ------------------------------------------------------------
create table if not exists public.business_settings (
  id               int primary key default 1 check (id = 1),
  business_name    text not null default 'Sri Lakshmi Mart',
  phone            text,
  whatsapp         text,
  email            text,
  address          text,
  fssai            text,
  minimum_order    numeric(10,2) not null default 0,
  delivery_charge  numeric(10,2) not null default 0,
  cod_enabled      boolean not null default true,
  low_stock_alerts boolean not null default true,
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ai_knowledge  (content the future assistant may draw on)
-- ------------------------------------------------------------
create table if not exists public.ai_knowledge (
  id          uuid primary key default uuid_generate_v4(),
  section     text not null check (section in ('business','products','faq','delivery',
                                               'payment','returns','offers','contact')),
  question    text,
  answer      text not null,
  keywords    text[],
  is_published boolean not null default false,
  sort_order  int not null default 0,
  updated_by  uuid references public.admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_knowledge_section_idx on public.ai_knowledge(section, is_published);

-- ------------------------------------------------------------
-- triggers
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admins','categories','products','customers','orders',
                           'offers','reviews','ai_knowledge']
  loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;
       create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- sequential, human-readable order numbers
create sequence if not exists public.order_number_seq start 1;
create sequence if not exists public.bill_number_seq  start 1;

create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'SLM-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists set_order_number on public.orders;
create trigger set_order_number before insert on public.orders
for each row execute function public.assign_order_number();

-- a new order raises a notification; the UI never fabricates one
create or replace function public.notify_new_order()
returns trigger language plpgsql as $$
begin
  insert into public.notifications (kind, title, body, entity_id)
  values ('new_order',
          'New order ' || new.order_number,
          new.customer_name || ' · ₹' || new.total::text,
          new.id);
  return new;
end $$;

drop trigger if exists on_new_order on public.orders;
create trigger on_new_order after insert on public.orders
for each row execute function public.notify_new_order();

-- stock movements keep inventory and its audit trail in step
create or replace function public.apply_stock_change()
returns trigger language plpgsql as $$
declare new_balance int;
begin
  update public.inventory
     set stock = stock + new.quantity, updated_at = now()
   where product_id = new.product_id
     and (variant_id is not distinct from new.variant_id)
  returning stock into new_balance;

  new.balance_after := new_balance;

  if new_balance is not null then
    if new_balance <= 0 then
      insert into public.notifications (kind, title, body, entity_id)
      values ('out_of_stock', 'Out of stock',
              (select name from public.products where id = new.product_id), new.product_id);
    elsif new_balance <= (select minimum_stock from public.inventory
                          where product_id = new.product_id
                            and (variant_id is not distinct from new.variant_id)) then
      insert into public.notifications (kind, title, body, entity_id)
      values ('low_stock', 'Low stock',
              (select name from public.products where id = new.product_id)
                || ' · ' || new_balance || ' left', new.product_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_stock_change on public.inventory_transactions;
create trigger on_stock_change before insert on public.inventory_transactions
for each row execute function public.apply_stock_change();

-- ------------------------------------------------------------
-- reporting helpers (kept in SQL so every screen agrees)
-- ------------------------------------------------------------
create or replace view public.order_totals as
select date_trunc('day', placed_at)::date as day,
       count(*)                            as orders,
       sum(total)                          as sales,
       coalesce(avg(total), 0)             as avg_order_value
from public.orders
where status <> 'cancelled'
group by 1;

create or replace view public.product_sales as
select oi.product_id,
       coalesce(p.name, oi.product_name) as product_name,
       p.category_id,
       sum(oi.quantity)  as units_sold,
       sum(oi.subtotal)  as revenue
from public.order_items oi
join public.orders o on o.id = oi.order_id and o.status <> 'cancelled'
left join public.products p on p.id = oi.product_id
group by 1,2,3;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Admin tables are staff-only. The customer site reads the public
-- catalogue with the anon key and writes nothing but its own orders.
-- ------------------------------------------------------------
alter table public.admins                  enable row level security;
alter table public.categories              enable row level security;
alter table public.products                enable row level security;
alter table public.product_variants        enable row level security;
alter table public.inventory               enable row level security;
alter table public.inventory_transactions  enable row level security;
alter table public.customers               enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.bills                   enable row level security;
alter table public.payments                enable row level security;
alter table public.offers                  enable row level security;
alter table public.reviews                 enable row level security;
alter table public.notifications           enable row level security;
alter table public.business_settings       enable row level security;
alter table public.ai_knowledge            enable row level security;

-- staff full access
do $$
declare t text;
begin
  foreach t in array array['admins','categories','products','product_variants','inventory',
                           'inventory_transactions','customers','orders','order_items','bills',
                           'payments','offers','reviews','notifications','business_settings',
                           'ai_knowledge']
  loop
    execute format('drop policy if exists staff_all on public.%I;', t);
    execute format($f$create policy staff_all on public.%I
                      for all to authenticated
                      using (public.is_admin()) with check (public.is_admin());$f$, t);
  end loop;
end $$;

-- public catalogue: anyone may read active items (the customer website)
drop policy if exists public_read_categories on public.categories;
create policy public_read_categories on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists public_read_products on public.products;
create policy public_read_products on public.products
  for select to anon, authenticated using (is_active);

drop policy if exists public_read_variants on public.product_variants;
create policy public_read_variants on public.product_variants
  for select to anon, authenticated using (is_active);

drop policy if exists public_read_inventory on public.inventory;
create policy public_read_inventory on public.inventory
  for select to anon, authenticated using (true);

drop policy if exists public_read_reviews on public.reviews;
create policy public_read_reviews on public.reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists public_read_offers on public.offers;
create policy public_read_offers on public.offers
  for select to anon, authenticated using (is_active);

-- the storefront may create an order, and nothing else
drop policy if exists public_create_order on public.orders;
create policy public_create_order on public.orders
  for insert to anon, authenticated with check (true);

drop policy if exists public_create_order_items on public.order_items;
create policy public_create_order_items on public.order_items
  for insert to anon, authenticated with check (true);

-- ------------------------------------------------------------
-- seed: the single settings row
-- ------------------------------------------------------------
insert into public.business_settings (id, business_name, phone, whatsapp, address, fssai)
values (1, 'Sri Lakshmi Mart', '+91 73052 76415', '917305276415',
        'Uthangarai, Krishnagiri District, Tamil Nadu, India', '22425103000163')
on conflict (id) do nothing;
