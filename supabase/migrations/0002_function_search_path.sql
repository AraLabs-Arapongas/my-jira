-- Pin search_path on trigger functions (addresses lint 0011)
alter function public.set_updated_at()               set search_path = public;
alter function public.prevent_default_column_delete() set search_path = public;
alter function public.seed_default_columns()         set search_path = public;
