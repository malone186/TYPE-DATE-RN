-- Replace the old monetization views after 202608310001.
-- No DROP CASCADE is used: if another database object depends on these views,
-- stop and review that dependency before applying this migration.

drop view if exists public.v_monetization_daily;
drop view if exists public.v_monetization;

create view public.v_monetization
with (security_invoker = on) as
select
  count(*) filter (where name = 'ad_shown'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as ad_impressions,
  count(distinct device_id) filter (where name = 'ad_shown'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as ad_viewers,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'purchase') as removals,
  count(distinct device_id) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'purchase') as removal_devices,
  count(distinct device_id) filter (where props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production') as all_devices,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'restore') as restore_events,
  count(*) filter (where name = 'remove_ads'
    and props ->> 'schema_version' = '2'
    and props ->> 'app_environment' = 'production'
    and props ->> 'source' = 'test') as test_events,
  (select count(*) from public.purchase_transactions
    where status = 'purchased' and is_test = false) as verified_purchases,
  (select count(*) from public.purchase_transactions
    where status = 'purchased' and is_test = true) as verified_test_purchases,
  (select count(*) from public.purchase_transactions
    where acknowledgement_status = 'pending') as acknowledgement_pending
from public.events
having public.is_admin();

create view public.v_monetization_daily
with (security_invoker = on) as
select
  created_at::date as day,
  count(*) filter (where name = 'ad_shown') as ad_impressions,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'purchase') as removals,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'restore') as restore_events,
  count(*) filter (where name = 'remove_ads' and props ->> 'source' = 'test') as test_events
from public.events
where props ->> 'schema_version' = '2'
  and props ->> 'app_environment' = 'production'
  and name in ('ad_shown', 'remove_ads')
group by 1
order by 1;
