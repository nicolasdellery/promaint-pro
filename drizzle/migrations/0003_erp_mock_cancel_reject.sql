ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS erp_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Mock ERP (CL-08): up to 3 attempts, each fails with probability 1/10; every attempt logged in events.
CREATE OR REPLACE FUNCTION public.erp_transmit(_order uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; n int; ref text;
BEGIN
  SELECT * INTO o FROM orders WHERE id = _order FOR UPDATE;
  IF o.id IS NULL OR o.status <> 'validated' THEN RETURN false; END IF;
  n := o.erp_attempts;
  WHILE n < 3 LOOP
    n := n + 1;
    IF random() < 0.1 THEN
      INSERT INTO events(type, object_type, object_id, message)
      VALUES ('erp_error','order',o.id,'Tentative ERP ' || n || '/3 : échec (timeout ERP simulé)');
    ELSE
      ref := 'ERP-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,6));
      UPDATE orders SET status = 'sent_to_erp', erp_reference = ref, erp_attempts = n WHERE id = o.id;
      INSERT INTO events(type, object_type, object_id, message)
      VALUES ('erp_attempt','order',o.id,'Tentative ERP ' || n || '/3 : succès — référence ' || ref);
      RETURN true;
    END IF;
  END LOOP;
  UPDATE orders SET erp_attempts = n WHERE id = o.id;
  INSERT INTO events(type, object_type, object_id, message)
  VALUES ('alert','order',o.id,'Alerte admin : transmission ERP impossible après 3 tentatives');
  RETURN false;
END $$;
REVOKE EXECUTE ON FUNCTION public.erp_transmit(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.orders_on_validated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'validated' AND OLD.status IS DISTINCT FROM 'validated' THEN
    PERFORM public.erp_transmit(NEW.id);
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_on_validated() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_orders_validated ON public.orders;
CREATE TRIGGER trg_orders_validated AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_on_validated();

-- Approver decision with mandatory reason on refusal
CREATE OR REPLACE FUNCTION public.decide_order(_order uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; me users%ROWTYPE; acc accounts%ROWTYPE;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  SELECT * INTO o FROM orders WHERE id = _order;
  IF o.id IS NULL OR o.status <> 'pending_approval' THEN RAISE EXCEPTION 'Commande non en attente de validation'; END IF;
  IF NOT (me.role = 'admin' OR (me.role = 'approver' AND me.account_id = o.account_id)) THEN RAISE EXCEPTION 'Action réservée au valideur du compte'; END IF;
  IF _approve THEN
    SELECT * INTO acc FROM accounts WHERE id = o.account_id FOR UPDATE;
    IF acc.current_outstanding + o.total_ht > acc.credit_limit THEN
      UPDATE orders SET status = 'blocked_credit' WHERE id = o.id;
      INSERT INTO events(type, object_type, object_id, message) VALUES ('alert','order',o.id,'Alerte admin : plafond d''encours dépassé à la validation');
    ELSE
      UPDATE accounts SET current_outstanding = current_outstanding + o.total_ht WHERE id = o.account_id;
      INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id,'Validée par ' || me.full_name);
      UPDATE orders SET status = 'validated' WHERE id = o.id;
    END IF;
  ELSE
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Motif de refus obligatoire'; END IF;
    UPDATE orders SET status = 'cancelled', rejection_reason = trim(_reason) WHERE id = o.id;
    INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id,'Refusée par ' || me.full_name || ' — motif : ' || trim(_reason));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_order(uuid, boolean, text) TO authenticated;

-- CL-09: cancel allowed up to "sent_to_erp" included
CREATE OR REPLACE FUNCTION public.cancel_order(_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; me users%ROWTYPE;
BEGIN
  SELECT * INTO me FROM users WHERE id = auth.uid();
  SELECT * INTO o FROM orders WHERE id = _order FOR UPDATE;
  IF o.id IS NULL OR NOT (me.role = 'admin' OR me.account_id = o.account_id) THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF o.status NOT IN ('draft','pending_approval','blocked_credit','validated','sent_to_erp') THEN
    RAISE EXCEPTION 'Commande déjà en préparation : contactez le service client';
  END IF;
  IF o.status IN ('validated','sent_to_erp') THEN
    UPDATE accounts SET current_outstanding = greatest(0, current_outstanding - o.total_ht) WHERE id = o.account_id;
  END IF;
  UPDATE orders SET status = 'cancelled' WHERE id = o.id;
  INSERT INTO events(type, object_type, object_id, message) VALUES ('status_change','order',o.id,'Annulée par ' || me.full_name);
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;