CREATE OR REPLACE FUNCTION luna_validate_stored_object_attachment() RETURNS trigger AS $$
DECLARE
  expected_kind text;
  expected_entity_type text;
  reference text;
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    expected_kind := 'account-images';
    expected_entity_type := 'account';
    reference := NEW.icon;
  ELSIF TG_TABLE_NAME = 'savings_instruments' THEN
    expected_kind := 'savings-images';
    expected_entity_type := 'savings_instrument';
    reference := NEW.icon;
  ELSE
    expected_kind := 'transaction-receipts';
    expected_entity_type := 'transaction';
    reference := NEW.receipt_image_url;
  END IF;

  IF reference IS NOT NULL AND (
    (TG_TABLE_NAME = 'accounts' AND (reference LIKE '/api/uploads/account-images/%' OR reference LIKE 'account-images/%')) OR
    (TG_TABLE_NAME = 'savings_instruments' AND (reference LIKE '/api/uploads/savings-images/%' OR reference LIKE 'savings-images/%')) OR
    (TG_TABLE_NAME = 'transactions')
  ) AND NOT EXISTS (
    SELECT 1 FROM stored_objects
    WHERE user_id = NEW.user_id
      AND kind = expected_kind
      AND status = 'attached'
      AND entity_type = expected_entity_type
      AND entity_id = NEW.id
      AND object_key IN (reference, replace(reference, '/api/uploads/' || expected_kind || '/', expected_kind || '/'))
  ) THEN
    RAISE EXCEPTION 'invalid % attachment', expected_kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER accounts_stored_object_attachment_guard
BEFORE INSERT OR UPDATE OF icon ON accounts
FOR EACH ROW EXECUTE FUNCTION luna_validate_stored_object_attachment();
--> statement-breakpoint
CREATE TRIGGER savings_instruments_stored_object_attachment_guard
BEFORE INSERT OR UPDATE OF icon ON savings_instruments
FOR EACH ROW EXECUTE FUNCTION luna_validate_stored_object_attachment();
--> statement-breakpoint
CREATE TRIGGER transactions_stored_object_attachment_guard
BEFORE INSERT OR UPDATE OF receipt_image_url ON transactions
FOR EACH ROW EXECUTE FUNCTION luna_validate_stored_object_attachment();
