-- Upload the genuine INTEQUITO PNG as a private, content-addressed object.
-- Never expose this reference as an unauthenticated public asset.
alter table public.crm_local_video_settings
 add column if not exists reference_path text,
 add column if not exists reference_sha256 text,
 add column if not exists reference_updated_at timestamptz;

alter table public.crm_local_video_settings
 drop constraint if exists crm_local_video_reference_pair;
alter table public.crm_local_video_settings
 add constraint crm_local_video_reference_pair check (
  (reference_path is null and reference_sha256 is null)
  or (reference_path ~ '^intequito/official-[a-f0-9]{64}\\.png$'
      and reference_sha256 ~ '^[a-f0-9]{64}$'
      and reference_path=('intequito/official-'||reference_sha256||'.png'))
 );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('crm-local-reference','crm-local-reference',false,6291456,array['image/png'])
on conflict (id) do update
set public=false,file_size_limit=6291456,allowed_mime_types=array['image/png'];
-- Private by default. No anonymous or authenticated storage.objects access.
-- The CRM backend alone uses a server-held service_role to upload and serve it.
