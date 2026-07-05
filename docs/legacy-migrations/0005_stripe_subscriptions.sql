-- drizzle/0005_stripe_subscriptions.sql
create table hop_customers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table hop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references hop_customers on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  status text not null check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: keep updated_at in sync
create trigger hop_customers_updated_at
  before update on hop_customers
  for each row execute procedure moddatetime (updated_at);

create trigger hop_subscriptions_updated_at
  before update on hop_subscriptions
  for each row execute procedure moddatetime (updated_at);
