ALTER TABLE `storenews`
ADD COLUMN `tagColor` VARCHAR(20) NULL;

UPDATE `storenews`
SET `tagColor` = '#ffba30'
WHERE `tag` IS NOT NULL AND TRIM(`tag`) <> '' AND (`tagColor` IS NULL OR TRIM(`tagColor`) = '');
