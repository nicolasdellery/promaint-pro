
CREATE OR REPLACE FUNCTION public.is_portal_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_portal_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_user() TO authenticated;

DROP POLICY "signed-in read catalog" ON public.products;
CREATE POLICY "portal users read catalog" ON public.products FOR SELECT TO authenticated USING (public.is_portal_user());
DROP POLICY "signed-in read tiers" ON public.tier_prices;
CREATE POLICY "portal users read tiers" ON public.tier_prices FOR SELECT TO authenticated USING (public.is_portal_user());
DROP POLICY "signed-in read stock" ON public.stock;
CREATE POLICY "portal users read stock" ON public.stock FOR SELECT TO authenticated USING (public.is_portal_user());

DROP POLICY "anyone can request an account" ON public.account_requests;
CREATE POLICY "valid account requests only" ON public.account_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(trim(company)) > 0
  AND length(trim(contact_name)) > 0
  AND created_at >= now() - interval '5 minutes'
  AND created_at <= now() + interval '5 minutes'
);
