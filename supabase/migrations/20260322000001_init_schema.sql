-- Meal personalization engine schema
-- Apply with: supabase db push  OR  psql "$DATABASE_URL" -f this file

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recipes + taxonomy attributes
-- ---------------------------------------------------------------------------
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  source_api text not null default 'seed',
  title text not null,
  image_url text,
  ready_in_minutes integer,
  servings integer,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  vegan boolean not null default false,
  vegetarian boolean not null default false,
  gluten_free boolean not null default false,
  dairy_free boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_api, external_id)
);

create table if not exists recipe_attributes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  attribute_type text not null,
  attribute_value text not null,
  unique (recipe_id, attribute_type, attribute_value)
);

create index if not exists idx_recipe_attributes_recipe
  on recipe_attributes (recipe_id);

create index if not exists idx_recipe_attributes_lookup
  on recipe_attributes (attribute_type, attribute_value);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  name text not null,
  amount text,
  unique (recipe_id, name)
);

create index if not exists idx_recipe_ingredients_name
  on recipe_ingredients (lower(name));

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- cuisine | meal_type | diet
  name text not null,
  unique (type, name)
);

create table if not exists recipe_categories (
  recipe_id uuid not null references recipes(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (recipe_id, category_id)
);

-- ---------------------------------------------------------------------------
-- User constraints (hard) + preferences (soft weights)
-- ---------------------------------------------------------------------------
create table if not exists user_constraints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  constraint_type text not null check (
    constraint_type in ('allergy', 'diet', 'excluded_ingredient')
  ),
  value text not null,
  created_at timestamptz not null default now(),
  unique (user_id, constraint_type, value)
);

create index if not exists idx_user_constraints_user
  on user_constraints (user_id);

create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  preference_type text not null,
  value text not null,
  weight numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, preference_type, value)
);

create index if not exists idx_user_preferences_user
  on user_preferences (user_id);

-- ---------------------------------------------------------------------------
-- Feedback loop + recommendation history
-- ---------------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  rating integer check (rating is null or (rating between 1 and 5)),
  liked boolean,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_user
  on feedback (user_id, created_at desc);

create table if not exists feedback_analysis (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references feedback(id) on delete cascade,
  sentiment text,
  extracted jsonb,
  is_valid boolean not null default false,
  error_message text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  context text not null default 'daily_recommendation',
  score numeric not null default 0,
  shown_at timestamptz not null default now()
);

create index if not exists idx_recommendations_user
  on recommendations (user_id, shown_at desc);

-- ---------------------------------------------------------------------------
-- AI-generated recipes (validated schema stored as JSON)
-- ---------------------------------------------------------------------------
create table if not exists generated_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  ingredients jsonb not null,
  steps jsonb not null,
  tags jsonb not null default '[]'::jsonb,
  calories numeric,
  ready_in_minutes integer,
  servings integer,
  raw_payload jsonb not null,
  is_valid boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_generated_recipes_user
  on generated_recipes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Hard-constraint filter (deterministic SQL — no LLM)
-- ---------------------------------------------------------------------------
create or replace function get_eligible_recipes(p_user_id uuid)
returns setof recipes
language sql
stable
as $$
  select r.*
  from recipes r
  where
    -- Allergy / excluded ingredient: drop recipes whose ingredients match
    not exists (
      select 1
      from user_constraints uc
      join recipe_ingredients ri on ri.recipe_id = r.id
      where uc.user_id = p_user_id
        and uc.constraint_type in ('allergy', 'excluded_ingredient')
        and ri.name ilike '%' || uc.value || '%'
    )
    -- Diet: if user has diet constraint(s), recipe must match via category OR flag
    and (
      not exists (
        select 1
        from user_constraints uc
        where uc.user_id = p_user_id
          and uc.constraint_type = 'diet'
      )
      or exists (
        select 1
        from user_constraints uc
        where uc.user_id = p_user_id
          and uc.constraint_type = 'diet'
          and (
            (
              lower(uc.value) = 'vegan' and r.vegan = true
            )
            or (
              lower(uc.value) = 'vegetarian' and r.vegetarian = true
            )
            or (
              lower(uc.value) in ('gluten_free', 'gluten-free') and r.gluten_free = true
            )
            or (
              lower(uc.value) in ('dairy_free', 'dairy-free') and r.dairy_free = true
            )
            or exists (
              select 1
              from recipe_categories rc
              join categories c on c.id = rc.category_id
              where rc.recipe_id = r.id
                and c.type = 'diet'
                and lower(c.name) = lower(uc.value)
            )
          )
      )
    );
$$;
