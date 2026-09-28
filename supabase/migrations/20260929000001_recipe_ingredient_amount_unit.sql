-- Split ingredient quantity into a numeric amount and a unit.
-- amount: 500.5, 2
-- unit: g, ml, cup, tbsp, egg
-- Existing text values such as '500g' or '1 lb' are parsed into those columns.
-- Databases that already store amount as numeric only gain the unit column.

alter table recipe_ingredients
  add column if not exists unit text;

alter table recipe_ingredients
  add column if not exists aisle text;

alter table recipe_ingredients
  add column if not exists created_at timestamptz not null default now();

do $$
declare
  amount_type text;
begin
  select data_type into amount_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'recipe_ingredients'
    and column_name = 'amount';

  if amount_type in ('text', 'character varying') then
    alter table recipe_ingredients add column if not exists amount_qty numeric;

    update recipe_ingredients
    set
      amount_qty = nullif(
        substring(btrim(amount) from '^([0-9]+(?:\.[0-9]+)?)'),
        ''
      )::numeric,
      unit = coalesce(
        unit,
        nullif(
          btrim(substring(btrim(amount) from '^[0-9]+(?:\.[0-9]+)?[[:space:]]*(.*)$')),
          ''
        ),
        name
      )
    where amount is not null;

    alter table recipe_ingredients drop column amount;
    alter table recipe_ingredients rename column amount_qty to amount;
  end if;
end $$;
