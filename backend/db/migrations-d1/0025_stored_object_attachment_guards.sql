-- D1's remote SQL API does not accept RAISE() in trigger bodies. The checked
-- guard row below provides the same atomic abort when an attachment is invalid.
CREATE TABLE `stored_object_attachment_guards` (
  `id` integer PRIMARY KEY CHECK (`id` = 1)
);
--> statement-breakpoint
CREATE TRIGGER `accounts_stored_object_attachment_insert`
BEFORE INSERT ON `accounts`
WHEN NEW.`icon` IS NOT NULL AND (NEW.`icon` LIKE '/api/uploads/account-images/%' OR NEW.`icon` LIKE 'account-images/%')
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'account-images'
      AND `status` = 'attached'
      AND `entity_type` = 'account'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`icon`, replace(NEW.`icon`, '/api/uploads/account-images/', 'account-images/'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER `accounts_stored_object_attachment_update`
BEFORE UPDATE OF `icon` ON `accounts`
WHEN NEW.`icon` IS NOT NULL AND (NEW.`icon` LIKE '/api/uploads/account-images/%' OR NEW.`icon` LIKE 'account-images/%')
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'account-images'
      AND `status` = 'attached'
      AND `entity_type` = 'account'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`icon`, replace(NEW.`icon`, '/api/uploads/account-images/', 'account-images/'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER `savings_instruments_stored_object_attachment_insert`
BEFORE INSERT ON `savings_instruments`
WHEN NEW.`icon` IS NOT NULL AND (NEW.`icon` LIKE '/api/uploads/savings-images/%' OR NEW.`icon` LIKE 'savings-images/%')
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'savings-images'
      AND `status` = 'attached'
      AND `entity_type` = 'savings_instrument'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`icon`, replace(NEW.`icon`, '/api/uploads/savings-images/', 'savings-images/'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER `savings_instruments_stored_object_attachment_update`
BEFORE UPDATE OF `icon` ON `savings_instruments`
WHEN NEW.`icon` IS NOT NULL AND (NEW.`icon` LIKE '/api/uploads/savings-images/%' OR NEW.`icon` LIKE 'savings-images/%')
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'savings-images'
      AND `status` = 'attached'
      AND `entity_type` = 'savings_instrument'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`icon`, replace(NEW.`icon`, '/api/uploads/savings-images/', 'savings-images/'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER `transactions_stored_object_attachment_insert`
BEFORE INSERT ON `transactions`
WHEN NEW.`receipt_image_url` IS NOT NULL
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'transaction-receipts'
      AND `status` = 'attached'
      AND `entity_type` = 'transaction'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`receipt_image_url`, replace(NEW.`receipt_image_url`, '/api/uploads/transaction-receipts/', 'transaction-receipts/'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER `transactions_stored_object_attachment_update`
BEFORE UPDATE OF `receipt_image_url` ON `transactions`
WHEN NEW.`receipt_image_url` IS NOT NULL
BEGIN
  INSERT INTO `stored_object_attachment_guards` (`id`)
  SELECT 0 WHERE NOT EXISTS (
    SELECT 1 FROM `stored_objects`
    WHERE `user_id` = NEW.`user_id`
      AND `kind` = 'transaction-receipts'
      AND `status` = 'attached'
      AND `entity_type` = 'transaction'
      AND `entity_id` = NEW.`id`
      AND `object_key` IN (NEW.`receipt_image_url`, replace(NEW.`receipt_image_url`, '/api/uploads/transaction-receipts/', 'transaction-receipts/'))
  );
END;
