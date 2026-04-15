ALTER TABLE `storeitem`
  ADD COLUMN `description` TEXT NULL;

UPDATE `storeitem`
SET `description` = COALESCE(NULLIF(`longDescription`, ''), NULLIF(`shortDescription`, ''), `description`);

ALTER TABLE `storeitem`
  DROP COLUMN `shortDescription`,
  DROP COLUMN `longDescription`;
