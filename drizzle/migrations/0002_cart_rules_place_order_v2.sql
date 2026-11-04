
ALTER TABLE public.orders ADD COLUMN client_request_id uuid UNIQUE;

DROP FUNCTION public.place_order(jsonb, boolean);

CREATE OR REPLACE FUNCTION public.place_order(_lines jsonb, _partial boolean, _request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc accounts%ROWTYPE; me users%ROWTYPE; oid uuid; l jsonb; pr products%ROWTYPE;
  q int; up numeric; org price_origin; total numeric := 0; pfee numeric; sfee numeric; st order_status;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  IF me.id IS NULL OR me.account_id IS NULL THEN RAISE EXCEPTION 'Compte client requis'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'Identifiant de requête manquant'; END IF;

  -- CL-07: idempotent — a repeated submit returns the order already created
  SELECT id INTO oid FROM orders WHERE client_request_id = _request_id AND created_by = me.id;
  IF oid IS NOT NULL THEN RETURN oid; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_request_id::text));
  SELECT id INTO oid FROM orders WHERE client_request_id = _request_id AND created_by = me.id;
  IF oid IS NOT NULL THEN RETURN oid; END IF;

  SELECT * INTO acc FROM accounts WHERE id = me.account_id FOR UPDATE;
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Panier vide'; END IF;

  INSERT INTO orders(account_id, created_by, status, partial_delivery_allowed, client_request_id)
  VALUES (acc.id, me.id, 'draft', COALESCE(_partial,false), _request_id) RETURNING id INTO oid;

  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO pr FROM products WHERE id = (l->>'product_id')::uuid;
    q := (l->>'quantity')::int;
    IF pr.id IS NULL THEN RAISE EXCEPTION 'Produit inconnu'; END IF;
    IF pr.status <> 'active' THEN RAISE EXCEPTION 'Produit % non commandable', pr.sku; END IF;
    IF q IS NULL OR q <= 0 THEN RAISE EXCEPTION 'Quantité invalide pour %', pr.sku; END IF;
    q := ceil(q::numeric / pr.pack_size)::int * pr.pack_size; -- RG-07
    SELECT cp.unit_price, cp.origin INTO up, org FROM compute_price(acc.id, pr.id, q) cp;
    INSERT INTO order_lines(order_id, product_id, quantity, unit_price_applied, price_origin) VALUES (oid, pr.id, q, up, org);
    total := total + up * q;
  END LOOP;
  total := round(total, 2);
  pfee := CASE WHEN total < 150 THEN 15 ELSE 0 END;  -- RG-05
  sfee := CASE WHEN total >= 400 THEN 0 ELSE 19 END; -- RG-06

  IF acc.current_outstanding + total > acc.credit_limit THEN
    st := 'blocked_credit'; -- RG-09 / CL-02
  ELSIF total > acc.approval_threshold AND me.role <> 'approver' THEN
    st := 'pending_approval'; -- RG-08
  ELSE
    st := 'validated'; -- includes CL-03 auto-approval
  END IF;

  UPDATE orders SET total_ht = total, processing_fee = pfee, shipping_fee = sfee, status = st WHERE id = oid;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',oid,'Commande créée — statut ' || st);

  IF st = 'blocked_credit' THEN
    INSERT INTO events(type, object_type, object_id, message)
    VALUES ('alert','order',oid,'Alerte admin : plafond d''encours dépassé pour ' || acc.name || ' (' || (acc.current_outstanding + total) || ' € / ' || acc.credit_limit || ' €)');
  ELSIF st = 'pending_approval' THEN
    INSERT INTO events(type, object_type, object_id, message)
    VALUES ('alert','order',oid,'Notification valideur : commande de ' || total || ' € HT à valider (' || me.full_name || ')');
  ELSE
    UPDATE accounts SET current_outstanding = current_outstanding + total WHERE id = acc.id;
    IF total > acc.approval_threshold THEN
      INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',oid,'Validation automatique (auteur valideur)');
    END IF;
  END IF;
  RETURN oid;
END $$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb,boolean,uuid) TO authenticated;
