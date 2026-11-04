Crée un portail de commande B2B appelé « ProMaint Pro » pour un distributeur fictif de pièces détachées et consommables de maintenance. Projet de démonstration : affiche en pied de page et sur la page d'accueil « Projet fictif réalisé par Nicolas Dellery — démonstration de démarche Product Builder. Aucune donnée réelle. »

Stack : React, Tailwind, shadcn/ui, Supabase (auth + base). Design sobre et professionnel, type outil métier : fond clair, une couleur d'accent bleu acier, typographie lisible, tableaux denses. Langue : français.

Crée les tables : accounts, users (avec rôle : buyer, approver, admin), products, contract_prices, tier_prices, stock, orders, order_lines, quotes, events, avec ces champs :
- accounts : id, name, account_discount (pourcentage), approval_threshold (€ HT, défaut 1000), credit_limit (€ HT), current_outstanding (€ HT)
- users : id, email, account_id (null pour l'admin ProMaint), role (buyer | approver | admin), full_name
- products : id, sku, name, family, catalog_price (€ HT), pack_size (1, 12 ou 24), status (active | discontinued | quote_only), technical_attributes (json), image_url
- contract_prices : id, account_id, product_id, price, end_date
- tier_prices : id, product_id, min_quantity, discount_percent
- stock : product_id, quantity, restock_delay_days
- orders : id, account_id, created_by, status (draft | pending_approval | blocked_credit | validated | sent_to_erp | in_preparation | shipped | delivered | cancelled), total_ht, processing_fee, shipping_fee, partial_delivery_allowed, erp_reference, tracking_number, created_at
- order_lines : id, order_id, product_id, quantity, unit_price_applied, price_origin (contract | tier | account_discount | catalog)
- quotes : id, account_id, requested_by, status (requested | priced | accepted | expired), total_ht, valid_until, created_at ; quote_lines : quote_id, product_id, quantity, unit_price
- events : id, type (erp_attempt | erp_error | alert | status_change), object_type, object_id, message, created_at
Active la sécurité par ligne (RLS) : un acheteur ou un valideur ne voit que les données de son compte, l'admin voit tout.

Remplis avec des données fictives cohérentes : 3 comptes clients (remises 0 %, 8 %, 12 % ; seuils de validation 1 000 € ; plafonds d'encours 5 000 €, 15 000 €, 30 000 €), 60 produits répartis en 6 familles (filtres CVC, courroies, éclairage, sanitaire, électricité, visserie), certains vendus par lot de 12 ou 24, 2 produits « sur devis », 1 produit « arrêté ». Crée 1 acheteur et 1 valideur par compte, et 1 admin ProMaint.

Règle d'accès : le catalogue et les prix ne sont visibles qu'après connexion. Un visiteur ne voit que la page d'accueil et un formulaire de demande d'ouverture de compte.