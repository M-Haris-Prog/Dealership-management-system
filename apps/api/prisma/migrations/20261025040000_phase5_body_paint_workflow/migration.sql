CREATE TABLE `body_paint_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `repair_order_id` VARCHAR(191) NOT NULL,
    `invoice_no` VARCHAR(60) NOT NULL,
    `status` ENUM('READY', 'POSTED', 'PAID') NOT NULL DEFAULT 'READY',
    `labor_total` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `materials_total` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(18,4) NOT NULL,
    `tax` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `total` DECIMAL(18,4) NOT NULL,
    `insurer_payable` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `customer_payable` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `journal_entry_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `posted_at` DATETIME(3) NULL,
    UNIQUE INDEX `body_paint_invoices_invoice_no_key`(`invoice_no`),
    INDEX `body_paint_invoices_repair_order_id_status_idx`(`repair_order_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `body_paint_repair_orders`
    MODIFY COLUMN `status` ENUM('OPEN', 'ASSESSMENT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_INVOICE', 'INVOICED', 'READY_FOR_COLLECTION', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN';

CREATE TABLE `body_paint_final_inspections` (
    `id` VARCHAR(191) NOT NULL,
    `repair_order_id` VARCHAR(191) NOT NULL,
    `passed` BOOLEAN NOT NULL,
    `checklist` JSON NOT NULL,
    `notes` VARCHAR(1000) NULL,
    `inspector_id` VARCHAR(191) NOT NULL,
    `inspected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `body_paint_final_inspections_repair_order_id_inspected_at_idx`(`repair_order_id`, `inspected_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `body_paint_invoices`
    ADD CONSTRAINT `body_paint_invoices_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `body_paint_final_inspections`
    ADD CONSTRAINT `body_paint_final_inspections_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `body_paint_final_inspections_inspector_id_fkey` FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
