
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('buyer','approver','admin');
CREATE TYPE public.product_status AS ENUM ('active','discontinued','quote_only');
CREATE TYPE public.order_status AS ENUM ('draft','pending_approval','blocked_credit','validated','sent_to_erp','in_preparation','shipped','delivered','cancelled');
CREATE TYPE public.price_origin AS ENUM ('contract','tier','account_discount','catalog');
CREATE TYPE public.quote_status AS ENUM ('requested','priced','accepted','expired');
CREATE TYPE public.event_type AS ENUM ('erp_attempt','erp_error','alert','status_change');

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_discount numeric(5,2) NOT NULL DEFAULT 0,
  approval_threshold numeric(12,2) NOT NULL DEFAULT 1000,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  current_outstanding numeric(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  full_name text NOT NULL
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  family text NOT NULL,
  catalog_price numeric(12,2) NOT NULL,
  pack_size int NOT NULL DEFAULT 1 CHECK (pack_size IN (1,12,24)),
  status public.product_status NOT NULL DEFAULT 'active',
  technical_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text
);
CREATE TABLE public.contract_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  end_date date NOT NULL
);
CREATE TABLE public.tier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity int NOT NULL,
  discount_percent numeric(5,2) NOT NULL
);
CREATE TABLE public.stock (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 0,
  restock_delay_days int NOT NULL DEFAULT 0
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id),
  status public.order_status NOT NULL DEFAULT 'draft',
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  processing_fee numeric(12,2) NOT NULL DEFAULT 0,
  shipping_fee numeric(12,2) NOT NULL DEFAULT 0,
  partial_delivery_allowed boolean NOT NULL DEFAULT false,
  erp_reference text,
  tracking_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_applied numeric(12,2) NOT NULL,
  price_origin public.price_origin NOT NULL
);
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id),
  status public.quote_status NOT NULL DEFAULT 'requested',
  total_ht numeric(12,2),
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_lines (
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2),
  PRIMARY KEY (quote_id, product_id)
);
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.event_type NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 200),
  siret text CHECK (siret IS NULL OR char_length(siret) <= 20),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accounts, public.users, public.products, public.contract_prices, public.tier_prices, public.stock, public.orders, public.order_lines, public.quotes, public.quote_lines, public.events TO authenticated;
GRANT INSERT ON public.quotes, public.quote_lines TO authenticated;
GRANT INSERT ON public.account_requests TO anon, authenticated;
GRANT SELECT ON public.account_requests TO authenticated;
GRANT ALL ON public.accounts, public.users, public.products, public.contract_prices, public.tier_prices, public.stock, public.orders, public.order_lines, public.quotes, public.quote_lines, public.events, public.account_requests TO service_role;

CREATE OR REPLACE FUNCTION public.current_account_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT account_id FROM public.users WHERE id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own account or admin" ON public.accounts FOR SELECT TO authenticated USING (id = public.current_account_id() OR public.is_admin());
CREATE POLICY "same account or admin" ON public.users FOR SELECT TO authenticated USING (id = auth.uid() OR account_id = public.current_account_id() OR public.is_admin());
CREATE POLICY "signed-in read catalog" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed-in read tiers" ON public.tier_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed-in read stock" ON public.stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "own contracts or admin" ON public.contract_prices FOR SELECT TO authenticated USING (account_id = public.current_account_id() OR public.is_admin());
CREATE POLICY "own orders or admin" ON public.orders FOR SELECT TO authenticated USING (account_id = public.current_account_id() OR public.is_admin());
CREATE POLICY "own order lines or admin" ON public.order_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.account_id = public.current_account_id() OR public.is_admin())));
CREATE POLICY "own quotes or admin" ON public.quotes FOR SELECT TO authenticated USING (account_id = public.current_account_id() OR public.is_admin());
CREATE POLICY "create own quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (account_id = public.current_account_id() AND requested_by = auth.uid() AND status = 'requested');
CREATE POLICY "own quote lines or admin" ON public.quote_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.account_id = public.current_account_id() OR public.is_admin())));
CREATE POLICY "add lines to own requested quote" ON public.quote_lines FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.requested_by = auth.uid() AND q.status = 'requested'));
CREATE POLICY "events visible to admin or own objects" ON public.events FOR SELECT TO authenticated USING (
  public.is_admin()
  OR (object_type = 'order' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = object_id AND o.account_id = public.current_account_id()))
);
CREATE POLICY "anyone can request an account" ON public.account_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin reads requests" ON public.account_requests FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.compute_price(_account uuid, _product uuid, _qty int)
RETURNS TABLE(unit_price numeric, origin public.price_origin)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p numeric; d numeric; c numeric; t numeric;
BEGIN
  SELECT catalog_price INTO p FROM products WHERE id = _product;
  SELECT account_discount INTO d FROM accounts WHERE id = _account;
  SELECT cp.price INTO c FROM contract_prices cp WHERE cp.account_id = _account AND cp.product_id = _product AND cp.end_date >= current_date ORDER BY cp.price LIMIT 1;
  IF c IS NOT NULL THEN RETURN QUERY SELECT c, 'contract'::price_origin; RETURN; END IF;
  SELECT tp.discount_percent INTO t FROM tier_prices tp WHERE tp.product_id = _product AND tp.min_quantity <= _qty ORDER BY tp.min_quantity DESC LIMIT 1;
  IF t IS NOT NULL AND t >= COALESCE(d,0) THEN RETURN QUERY SELECT round(p * (1 - t/100), 2), 'tier'::price_origin; RETURN; END IF;
  IF COALESCE(d,0) > 0 THEN RETURN QUERY SELECT round(p * (1 - d/100), 2), 'account_discount'::price_origin; RETURN; END IF;
  RETURN QUERY SELECT p, 'catalog'::price_origin;
END $$;

CREATE OR REPLACE FUNCTION public.my_price(_product uuid, _qty int)
RETURNS TABLE(unit_price numeric, origin public.price_origin)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.compute_price(public.current_account_id(), _product, _qty)
  WHERE auth.uid() IS NOT NULL AND public.current_account_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.place_order(_lines jsonb, _partial boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc accounts%ROWTYPE; me users%ROWTYPE; oid uuid; l jsonb; pr products%ROWTYPE;
  q int; up numeric; org price_origin; total numeric := 0; pfee numeric; sfee numeric; st order_status;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  IF me.id IS NULL OR me.account_id IS NULL THEN RAISE EXCEPTION 'Compte client requis'; END IF;
  SELECT * INTO acc FROM accounts WHERE id = me.account_id;
  IF jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Panier vide'; END IF;
  INSERT INTO orders(account_id, created_by, status, partial_delivery_allowed) VALUES (acc.id, me.id, 'draft', COALESCE(_partial,false)) RETURNING id INTO oid;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO pr FROM products WHERE id = (l->>'product_id')::uuid;
    q := (l->>'quantity')::int;
    IF pr.id IS NULL THEN RAISE EXCEPTION 'Produit inconnu'; END IF;
    IF pr.status <> 'active' THEN RAISE EXCEPTION 'Produit % non commandable (%)', pr.sku, pr.status; END IF;
    IF q IS NULL OR q <= 0 OR q % pr.pack_size <> 0 THEN RAISE EXCEPTION 'Quantité de % doit être un multiple de %', pr.sku, pr.pack_size; END IF;
    SELECT cp.unit_price, cp.origin INTO up, org FROM compute_price(acc.id, pr.id, q) cp;
    INSERT INTO order_lines(order_id, product_id, quantity, unit_price_applied, price_origin) VALUES (oid, pr.id, q, up, org);
    total := total + up * q;
  END LOOP;
  pfee := CASE WHEN total < 150 THEN 15 ELSE 0 END;
  sfee := CASE WHEN total >= 500 THEN 0 ELSE 25 END;
  IF acc.current_outstanding + total > acc.credit_limit THEN st := 'blocked_credit';
  ELSIF me.role = 'buyer' AND total >= acc.approval_threshold THEN st := 'pending_approval';
  ELSE st := 'validated'; END IF;
  UPDATE orders SET total_ht = round(total,2), processing_fee = pfee, shipping_fee = sfee, status = st WHERE id = oid;
  IF st = 'validated' THEN UPDATE accounts SET current_outstanding = current_outstanding + total WHERE id = acc.id; END IF;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',oid,'Commande créée — statut ' || st);
  IF st = 'blocked_credit' THEN INSERT INTO events(type, object_type, object_id, message) VALUES ('alert','order',oid,'Plafond d''encours dépassé pour ' || acc.name); END IF;
  RETURN oid;
END $$;

CREATE OR REPLACE FUNCTION public.approve_order(_order uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; me users%ROWTYPE; acc accounts%ROWTYPE;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  SELECT * INTO o FROM orders WHERE id = _order;
  IF o.id IS NULL OR o.status <> 'pending_approval' THEN RAISE EXCEPTION 'Commande non en attente de validation'; END IF;
  IF NOT (me.role = 'admin' OR (me.role = 'approver' AND me.account_id = o.account_id)) THEN RAISE EXCEPTION 'Action réservée au valideur du compte'; END IF;
  IF _approve THEN
    SELECT * INTO acc FROM accounts WHERE id = o.account_id;
    IF acc.current_outstanding + o.total_ht > acc.credit_limit THEN
      UPDATE orders SET status = 'blocked_credit' WHERE id = o.id;
    ELSE
      UPDATE orders SET status = 'validated' WHERE id = o.id;
      UPDATE accounts SET current_outstanding = current_outstanding + o.total_ht WHERE id = o.account_id;
    END IF;
  ELSE
    UPDATE orders SET status = 'cancelled' WHERE id = o.id;
  END IF;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id, CASE WHEN _approve THEN 'Validée par ' ELSE 'Refusée par ' END || me.full_name);
END $$;

REVOKE EXECUTE ON FUNCTION public.compute_price(uuid,uuid,int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_price(uuid,int), public.place_order(jsonb,boolean), public.approve_order(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_price(uuid,int), public.place_order(jsonb,boolean), public.approve_order(uuid,boolean) TO authenticated;

-- ===== SEED =====
INSERT INTO public.accounts (id, name, account_discount, approval_threshold, credit_limit, current_outstanding) VALUES
 ('a0000000-0000-0000-0000-000000000001','Résidences Horizon (bailleur)',0,1000,5000,3200),
 ('a0000000-0000-0000-0000-000000000002','Clinique Saint-Aubin',8,1000,15000,6400),
 ('a0000000-0000-0000-0000-000000000003','Logistique Ouest Facility',12,1000,30000,11800);

WITH fam(family, code, names, base) AS (VALUES
 ('Filtres CVC','FLT', ARRAY['Filtre plissé G4 592x592','Filtre plissé M5 592x287','Filtre poche F7 592x592','Filtre compact F9 592x592','Média filtrant G3 rouleau 20m','Filtre charbon actif 287x592','Préfiltre métallique 500x500','Filtre HEPA H13 610x610','Filtre panneau G4 495x495','Cadre filtre universel 592'], 18),
 ('Courroies','CRR', ARRAY['Courroie trapézoïdale SPZ 1250','Courroie trapézoïdale SPA 1500','Courroie crantée XPZ 1000','Courroie poly-V 6PK1200','Courroie trapézoïdale A42','Courroie trapézoïdale B56','Courroie synchrone HTD 8M','Courroie XPA 1800','Courroie SPB 2000','Kit poulie + courroie VMC'], 14),
 ('Éclairage','ECL', ARRAY['Tube LED T8 120cm 18W','Dalle LED 600x600 36W','Ampoule LED E27 9W','Projecteur LED 50W IP65','Hublot LED détecteur 15W','Bloc secours BAES 45lm','Réglette LED étanche 150cm','Spot LED GU10 5W','Downlight LED 18W','Tube LED T5 115cm 16W'], 12),
 ('Sanitaire','SAN', ARRAY['Mitigeur lavabo temporisé','Flexible inox 50cm M/F','Joint fibre 20x27','Robinet flotteur WC','Mécanisme chasse double','Siphon lavabo PVC 32','Abattant WC collectivité','Cartouche céramique 35mm','Clapet anti-retour 1/2','Bouton poussoir urinoir'], 22),
 ('Électricité','ELC', ARRAY['Disjoncteur 1P+N 16A','Interrupteur différentiel 40A 30mA','Prise 2P+T encastrée','Boîte de dérivation IP55','Câble R2V 3G2,5 (m)','Contacteur modulaire 25A','Bornier Wago 5 entrées','Gaine ICTA 20mm (m)','Télérupteur 16A','Minuterie cage escalier'], 16),
 ('Visserie','VIS', ARRAY['Vis bois TF 4x40 inox','Cheville nylon 8mm','Boulon HM8x40 zingué','Écrou HM8 nylstop','Rondelle plate M8','Vis autoforeuse 4,8x19','Tige filetée M8 1m','Cheville Molly M5','Collier de serrage 300mm','Vis béton 7,5x80'], 3)
), expanded AS (
  SELECT f.family, f.code, f.base, n, i FROM fam f, unnest(f.names) WITH ORDINALITY AS u(n, i)
)
INSERT INTO public.products (sku, name, family, catalog_price, pack_size, status, technical_attributes)
SELECT code || '-' || lpad(i::text, 3, '0'), n, family,
  round((base * (0.6 + (i * 0.37)::numeric % 1.8))::numeric, 2),
  CASE WHEN code = 'VIS' AND i <= 6 THEN 24 WHEN code IN ('VIS','ECL') AND i IN (1,3,8) THEN 12 WHEN code = 'SAN' AND i = 3 THEN 24 WHEN code='ELC' AND i = 7 THEN 12 ELSE 1 END,
  CASE WHEN code='FLT' AND i = 8 THEN 'quote_only'::product_status WHEN code='CRR' AND i = 10 THEN 'quote_only'::product_status WHEN code='ECL' AND i = 10 THEN 'discontinued'::product_status ELSE 'active'::product_status END,
  CASE code
    WHEN 'FLT' THEN jsonb_build_object('classe', split_part(n,' ',3), 'dimensions', split_part(n,' ',4))
    WHEN 'CRR' THEN jsonb_build_object('profil', split_part(n,' ',3), 'longueur_mm', split_part(n,' ',4))
    WHEN 'ECL' THEN jsonb_build_object('temperature_k', 4000, 'garantie_ans', 3)
    WHEN 'SAN' THEN jsonb_build_object('materiau', 'laiton chromé', 'norme', 'NF')
    WHEN 'ELC' THEN jsonb_build_object('norme', 'NF C 15-100', 'tension_v', 230)
    ELSE jsonb_build_object('finition', 'zingué blanc', 'conditionnement', 'boîte')
  END
FROM expanded;

UPDATE public.products SET catalog_price = 420 WHERE sku = 'FLT-008';
UPDATE public.products SET catalog_price = 980 WHERE sku = 'CRR-010';

INSERT INTO public.stock (product_id, quantity, restock_delay_days)
SELECT id,
  CASE WHEN status='discontinued' THEN 0 WHEN (abs(hashtext(sku)) % 7) = 0 THEN 0 ELSE (abs(hashtext(sku)) % 300) + pack_size * 4 END,
  CASE WHEN (abs(hashtext(sku)) % 7) = 0 THEN 10 ELSE 2 END
FROM public.products;

INSERT INTO public.tier_prices (product_id, min_quantity, discount_percent)
SELECT id, 10 * pack_size, 5 FROM public.products WHERE status='active' AND family IN ('Filtres CVC','Éclairage','Visserie')
UNION ALL
SELECT id, 50 * pack_size, 10 FROM public.products WHERE status='active' AND family IN ('Filtres CVC','Éclairage','Visserie');

INSERT INTO public.contract_prices (account_id, product_id, price, end_date)
SELECT 'a0000000-0000-0000-0000-000000000003'::uuid, id, round(catalog_price * 0.78, 2), current_date + 180 FROM public.products WHERE sku IN ('FLT-001','FLT-002','FLT-003','ECL-001','ELC-001')
UNION ALL
SELECT 'a0000000-0000-0000-0000-000000000002'::uuid, id, round(catalog_price * 0.85, 2), current_date + 90 FROM public.products WHERE sku IN ('SAN-001','SAN-004','ECL-002')
UNION ALL
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid, id, round(catalog_price * 0.9, 2), current_date - 10 FROM public.products WHERE sku IN ('FLT-001');

WITH u(id, email, full_name) AS (VALUES
 ('b0000000-0000-0000-0000-000000000001'::uuid,'acheteur.horizon@promaint.demo','Camille Martin'),
 ('b0000000-0000-0000-0000-000000000002'::uuid,'valideur.horizon@promaint.demo','Julien Bernard'),
 ('b0000000-0000-0000-0000-000000000003'::uuid,'acheteur.staubin@promaint.demo','Sophie Petit'),
 ('b0000000-0000-0000-0000-000000000004'::uuid,'valideur.staubin@promaint.demo','Marc Durand'),
 ('b0000000-0000-0000-0000-000000000005'::uuid,'acheteur.ouest@promaint.demo','Léa Moreau'),
 ('b0000000-0000-0000-0000-000000000006'::uuid,'valideur.ouest@promaint.demo','Thomas Laurent'),
 ('b0000000-0000-0000-0000-000000000007'::uuid,'admin@promaint.demo','Admin ProMaint')
)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name), now(), now(), '', '', '', ''
FROM u;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
FROM auth.users WHERE email LIKE '%@promaint.demo';

INSERT INTO public.users (id, email, account_id, role, full_name) VALUES
 ('b0000000-0000-0000-0000-000000000001','acheteur.horizon@promaint.demo','a0000000-0000-0000-0000-000000000001','buyer','Camille Martin'),
 ('b0000000-0000-0000-0000-000000000002','valideur.horizon@promaint.demo','a0000000-0000-0000-0000-000000000001','approver','Julien Bernard'),
 ('b0000000-0000-0000-0000-000000000003','acheteur.staubin@promaint.demo','a0000000-0000-0000-0000-000000000002','buyer','Sophie Petit'),
 ('b0000000-0000-0000-0000-000000000004','valideur.staubin@promaint.demo','a0000000-0000-0000-0000-000000000002','approver','Marc Durand'),
 ('b0000000-0000-0000-0000-000000000005','acheteur.ouest@promaint.demo','a0000000-0000-0000-0000-000000000003','buyer','Léa Moreau'),
 ('b0000000-0000-0000-0000-000000000006','valideur.ouest@promaint.demo','a0000000-0000-0000-0000-000000000003','approver','Thomas Laurent'),
 ('b0000000-0000-0000-0000-000000000007','admin@promaint.demo',NULL,'admin','Admin ProMaint');

INSERT INTO public.orders (id, account_id, created_by, status, total_ht, processing_fee, shipping_fee, partial_delivery_allowed, erp_reference, tracking_number, created_at) VALUES
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000005','delivered',1840.50,0,0,true,'ERP-24-08812','COL-7781230FR', now() - interval '20 days'),
 ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000005','shipped',612.00,0,0,false,'ERP-24-09104','COL-7790011FR', now() - interval '4 days'),
 ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000003','pending_approval',1325.40,0,0,false,NULL,NULL, now() - interval '1 day'),
 ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','blocked_credit',2150.00,0,0,false,NULL,NULL, now() - interval '2 days'),
 ('c0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000004','sent_to_erp',388.20,0,25,true,NULL,NULL, now() - interval '3 hours');

INSERT INTO public.order_lines (order_id, product_id, quantity, unit_price_applied, price_origin)
SELECT 'c0000000-0000-0000-0000-000000000001'::uuid, id, 40, round(catalog_price*0.78,2), 'contract'::public.price_origin FROM public.products WHERE sku='FLT-001'
UNION ALL SELECT 'c0000000-0000-0000-0000-000000000002'::uuid, id, 24, round(catalog_price*0.88,2), 'account_discount'::public.price_origin FROM public.products WHERE sku='ECL-001'
UNION ALL SELECT 'c0000000-0000-0000-0000-000000000003'::uuid, id, 30, round(catalog_price*0.92,2), 'account_discount'::public.price_origin FROM public.products WHERE sku='SAN-002'
UNION ALL SELECT 'c0000000-0000-0000-0000-000000000004'::uuid, id, 50, catalog_price, 'catalog'::public.price_origin FROM public.products WHERE sku='CRR-002'
UNION ALL SELECT 'c0000000-0000-0000-0000-000000000005'::uuid, id, 10, round(catalog_price*0.92,2), 'account_discount'::public.price_origin FROM public.products WHERE sku='ELC-002';

INSERT INTO public.quotes (id, account_id, requested_by, status, total_ht, valid_until, created_at) VALUES
 ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000005','priced',3780.00,current_date + 25, now() - interval '5 days'),
 ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','requested',NULL,NULL, now() - interval '1 day');
INSERT INTO public.quote_lines (quote_id, product_id, quantity, unit_price)
SELECT 'd0000000-0000-0000-0000-000000000001'::uuid, id, 10, 378.00::numeric FROM public.products WHERE sku='FLT-008'
UNION ALL SELECT 'd0000000-0000-0000-0000-000000000002'::uuid, id, 2, NULL::numeric FROM public.products WHERE sku='CRR-010';

INSERT INTO public.events (type, object_type, object_id, message, created_at) VALUES
 ('erp_attempt','order','c0000000-0000-0000-0000-000000000005','Envoi ERP tentative 1/3', now() - interval '3 hours'),
 ('erp_error','order','c0000000-0000-0000-0000-000000000005','ERP timeout (504) — nouvel essai planifié', now() - interval '2 hours 50 minutes'),
 ('alert','order','c0000000-0000-0000-0000-000000000004','Plafond d''encours dépassé pour Résidences Horizon', now() - interval '2 days'),
 ('status_change','order','c0000000-0000-0000-0000-000000000002','Expédiée — COL-7790011FR', now() - interval '2 days');
