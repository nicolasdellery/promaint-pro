ALTER TYPE public.price_origin ADD VALUE IF NOT EXISTS 'quote';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS erp_blocked_reason text;

-- RG-12: quote request from cart lines (or a single quote-only product)
CREATE OR REPLACE FUNCTION public.request_quote(_lines jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me users%ROWTYPE; qid uuid; l jsonb; pr products%ROWTYPE; q int;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  IF me.id IS NULL OR me.account_id IS NULL THEN RAISE EXCEPTION 'Compte client requis'; END IF;
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Aucun article'; END IF;
  INSERT INTO quotes(account_id, requested_by, status) VALUES (me.account_id, me.id, 'requested') RETURNING id INTO qid;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO pr FROM products WHERE id = (l->>'product_id')::uuid;
    q := (l->>'quantity')::int;
    IF pr.id IS NULL OR q IS NULL OR q <= 0 THEN RAISE EXCEPTION 'Ligne invalide'; END IF;
    q := ceil(q::numeric / pr.pack_size)::int * pr.pack_size;
    INSERT INTO quote_lines(quote_id, product_id, quantity) VALUES (qid, pr.id, q);
  END LOOP;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','quote',qid,'Demande de devis par ' || me.full_name);
  RETURN qid;
END $$;
GRANT EXECUTE ON FUNCTION public.request_quote(jsonb) TO authenticated;

-- RG-13: admin prices a quote, valid 30 days
CREATE OR REPLACE FUNCTION public.price_quote(_quote uuid, _prices jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t numeric;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM quotes WHERE id = _quote AND status = 'requested') THEN RAISE EXCEPTION 'Devis non chiffrable'; END IF;
  UPDATE quote_lines ql SET unit_price = (_prices->>ql.product_id::text)::numeric WHERE ql.quote_id = _quote;
  IF EXISTS (SELECT 1 FROM quote_lines WHERE quote_id = _quote AND (unit_price IS NULL OR unit_price <= 0)) THEN RAISE EXCEPTION 'Prix manquant'; END IF;
  SELECT round(sum(unit_price * quantity),2) INTO t FROM quote_lines WHERE quote_id = _quote;
  UPDATE quotes SET status = 'priced', total_ht = t, valid_until = current_date + 30 WHERE id = _quote;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','quote',_quote,'Devis chiffré : ' || t || ' € HT, valable 30 jours');
END $$;
GRANT EXECUTE ON FUNCTION public.price_quote(uuid, jsonb) TO authenticated;

-- RG-13: client accepts a valid quote → order at quote prices
CREATE OR REPLACE FUNCTION public.accept_quote(_quote uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me users%ROWTYPE; qt quotes%ROWTYPE; acc accounts%ROWTYPE; oid uuid; t numeric; st order_status;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  SELECT * INTO qt FROM quotes WHERE id = _quote FOR UPDATE;
  IF qt.id IS NULL OR qt.account_id IS DISTINCT FROM me.account_id THEN RAISE EXCEPTION 'Devis introuvable'; END IF;
  IF qt.status <> 'priced' THEN RAISE EXCEPTION 'Devis non acceptable'; END IF;
  IF qt.valid_until < current_date THEN
    UPDATE quotes SET status = 'expired' WHERE id = qt.id;
    RETURN NULL;
  END IF;
  SELECT * INTO acc FROM accounts WHERE id = qt.account_id FOR UPDATE;
  t := qt.total_ht;
  INSERT INTO orders(account_id, created_by, status, quote_id, total_ht, processing_fee, shipping_fee)
  VALUES (acc.id, me.id, 'draft', qt.id, t, CASE WHEN t < 150 THEN 15 ELSE 0 END, CASE WHEN t >= 400 THEN 0 ELSE 19 END)
  RETURNING id INTO oid;
  INSERT INTO order_lines(order_id, product_id, quantity, unit_price_applied, price_origin)
  SELECT oid, product_id, quantity, unit_price, 'quote' FROM quote_lines WHERE quote_id = qt.id;
  UPDATE quotes SET status = 'accepted', order_id = oid WHERE id = qt.id;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',oid,'Commande créée depuis devis accepté par ' || me.full_name);
  IF acc.current_outstanding + t > acc.credit_limit THEN
    UPDATE orders SET status = 'blocked_credit' WHERE id = oid;
    INSERT INTO events(type, object_type, object_id, message) VALUES ('alert','order',oid,'Alerte admin : plafond d''encours dépassé pour ' || acc.name);
  ELSE
    UPDATE accounts SET current_outstanding = current_outstanding + t WHERE id = acc.id;
    UPDATE orders SET status = 'validated' WHERE id = oid;
  END IF;
  RETURN oid;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;

-- CL-06: ERP transmission blocked while an order line references a discontinued product
CREATE OR REPLACE FUNCTION public.erp_transmit(_order uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; n int; ref text; stopped text;
BEGIN
  SELECT * INTO o FROM orders WHERE id = _order FOR UPDATE;
  IF o.id IS NULL OR o.status <> 'validated' THEN RETURN false; END IF;
  SELECT string_agg(p.sku, ', ') INTO stopped FROM order_lines ol JOIN products p ON p.id = ol.product_id
   WHERE ol.order_id = o.id AND p.status = 'discontinued';
  IF stopped IS NOT NULL THEN
    UPDATE orders SET erp_blocked_reason = 'Référence arrêtée : ' || stopped WHERE id = o.id;
    INSERT INTO events(type, object_type, object_id, message) VALUES ('alert','order',o.id,'Transmission ERP bloquée — référence arrêtée : ' || stopped || ' (remplacement requis)');
    RETURN false;
  END IF;
  UPDATE orders SET erp_blocked_reason = NULL WHERE id = o.id;
  n := o.erp_attempts;
  WHILE n < 3 LOOP
    n := n + 1;
    IF random() < 0.1 THEN
      INSERT INTO events(type, object_type, object_id, message) VALUES ('erp_error','order',o.id,'Tentative ERP ' || n || '/3 : échec (timeout ERP simulé)');
    ELSE
      ref := 'ERP-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,6));
      UPDATE orders SET status = 'sent_to_erp', erp_reference = ref, erp_attempts = n WHERE id = o.id;
      INSERT INTO events(type, object_type, object_id, message) VALUES ('erp_attempt','order',o.id,'Tentative ERP ' || n || '/3 : succès — référence ' || ref);
      RETURN true;
    END IF;
  END LOOP;
  UPDATE orders SET erp_attempts = n WHERE id = o.id;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('alert','order',o.id,'Alerte admin : transmission ERP impossible après 3 tentatives');
  RETURN false;
END $$;
REVOKE EXECUTE ON FUNCTION public.erp_transmit(uuid) FROM PUBLIC, anon, authenticated;

-- CL-06: replace a discontinued line (same price) then retry ERP
CREATE OR REPLACE FUNCTION public.replace_order_line(_line uuid, _product uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ol order_lines%ROWTYPE; o orders%ROWTYPE; me users%ROWTYPE;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  SELECT * INTO ol FROM order_lines WHERE id = _line;
  SELECT * INTO o FROM orders WHERE id = ol.order_id;
  IF o.id IS NULL OR NOT (me.role = 'admin' OR me.account_id = o.account_id) THEN RAISE EXCEPTION 'Ligne introuvable'; END IF;
  IF o.status <> 'validated' THEN RAISE EXCEPTION 'Commande non modifiable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = _product AND status = 'active') THEN RAISE EXCEPTION 'Produit de remplacement invalide'; END IF;
  UPDATE order_lines SET product_id = _product WHERE id = _line;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id,'Ligne remplacée par ' || me.full_name);
  PERFORM erp_transmit(o.id);
END $$;
GRANT EXECUTE ON FUNCTION public.replace_order_line(uuid, uuid) TO authenticated;

-- Admin back-office
CREATE OR REPLACE FUNCTION public.admin_update_account(_id uuid, _discount numeric, _threshold numeric, _credit numeric, _outstanding numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  IF _discount < 0 OR _discount > 100 OR _threshold < 0 OR _credit < 0 OR _outstanding < 0 THEN RAISE EXCEPTION 'Valeurs invalides'; END IF;
  UPDATE accounts SET account_discount = _discount, approval_threshold = _threshold, credit_limit = _credit, current_outstanding = _outstanding WHERE id = _id;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','account',_id,'Paramètres du compte modifiés');
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_account(uuid, numeric, numeric, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_contract_price(_account uuid, _product uuid, _price numeric, _end date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  IF _price IS NULL OR _price <= 0 OR _end IS NULL THEN RAISE EXCEPTION 'Valeurs invalides'; END IF;
  DELETE FROM contract_prices WHERE account_id = _account AND product_id = _product;
  INSERT INTO contract_prices(account_id, product_id, price, end_date) VALUES (_account, _product, _price, _end);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_contract_price(uuid, uuid, numeric, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_contract_price(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  DELETE FROM contract_prices WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_contract_price(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_simulate_shipment(_order uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE trk text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = _order AND status IN ('sent_to_erp','in_preparation')) THEN RAISE EXCEPTION 'Commande non expédiable'; END IF;
  trk := 'COLIS-' || upper(substr(md5(random()::text),1,10));
  UPDATE orders SET status = 'shipped', tracking_number = trk WHERE id = _order;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',_order,'Expédition simulée — suivi ' || trk);
  RETURN trk;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_simulate_shipment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_retry_erp(_order uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  UPDATE orders SET erp_attempts = 0 WHERE id = _order AND status = 'validated';
  RETURN erp_transmit(_order);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_retry_erp(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_release_credit(_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''admin'; END IF;
  SELECT * INTO o FROM orders WHERE id = _order AND status = 'blocked_credit';
  IF o.id IS NULL THEN RAISE EXCEPTION 'Commande non bloquée'; END IF;
  UPDATE accounts SET current_outstanding = current_outstanding + o.total_ht WHERE id = o.account_id;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id,'Débloquée par l''admin (dérogation encours)');
  UPDATE orders SET status = 'validated' WHERE id = o.id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_release_credit(uuid) TO authenticated;

-- events on quotes visible to their account
DROP POLICY IF EXISTS "events visible to admin or own objects" ON public.events;
CREATE POLICY "events visible to admin or own objects" ON public.events FOR SELECT TO authenticated USING (
  is_admin()
  OR (object_type = 'order' AND EXISTS (SELECT 1 FROM orders o WHERE o.id = events.object_id AND o.account_id = current_account_id()))
  OR (object_type = 'quote' AND EXISTS (SELECT 1 FROM quotes q WHERE q.id = events.object_id AND q.account_id = current_account_id()))
);