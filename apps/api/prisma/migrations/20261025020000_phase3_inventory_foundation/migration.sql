CREATE TABLE `part_categories` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `part_categories_code_key`(`code`),
    INDEX `part_categories_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `parts`
    ADD COLUMN `category_id` VARCHAR(191) NULL,
    ADD COLUMN `max_stock_level` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `parts`
    ADD CONSTRAINT `parts_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `part_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_balances`
    ADD COLUMN `average_cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN `inventory_value` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `stock_transactions`
    ADD COLUMN `unit_cost` DECIMAL(18,4) NULL,
    ADD COLUMN `total_cost` DECIMAL(18,4) NULL;

ALTER TABLE `purchase_order_lines`
    ADD COLUMN `received_quantity` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `goods_receipt_lines`
    ADD COLUMN `unit_cost` DECIMAL(18,4) NULL;

ALTER TABLE `parts_request_lines`
    ADD COLUMN `issued_quantity` DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('REQUESTED', 'ISSUED', 'RETURNED') NOT NULL DEFAULT 'REQUESTED';

ALTER TABLE `parts_issues`
    ADD COLUMN `total_cost` DECIMAL(18,4) NULL,
    ADD COLUMN `journal_entry_id` VARCHAR(191) NULL;
