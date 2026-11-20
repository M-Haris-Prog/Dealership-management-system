-- DropForeignKey
ALTER TABLE `body_paint_approvals` DROP FOREIGN KEY `body_paint_approvals_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_damage_assessments` DROP FOREIGN KEY `body_paint_damage_assessments_assessor_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_damage_assessments` DROP FOREIGN KEY `body_paint_damage_assessments_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_insurance_cases` DROP FOREIGN KEY `body_paint_insurance_cases_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_invoice_ready_summaries` DROP FOREIGN KEY `body_paint_invoice_ready_summaries_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_material_consumptions` DROP FOREIGN KEY `body_paint_material_consumptions_operation_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_material_consumptions` DROP FOREIGN KEY `body_paint_material_consumptions_part_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_material_consumptions` DROP FOREIGN KEY `body_paint_material_consumptions_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_operations` DROP FOREIGN KEY `body_paint_operations_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_operations` DROP FOREIGN KEY `body_paint_operations_technician_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_repair_orders` DROP FOREIGN KEY `body_paint_repair_orders_branch_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_repair_orders` DROP FOREIGN KEY `body_paint_repair_orders_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_repair_orders` DROP FOREIGN KEY `body_paint_repair_orders_customer_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_repair_orders` DROP FOREIGN KEY `body_paint_repair_orders_vehicle_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_vehicle_movements` DROP FOREIGN KEY `body_paint_vehicle_movements_from_location_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_vehicle_movements` DROP FOREIGN KEY `body_paint_vehicle_movements_moved_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_vehicle_movements` DROP FOREIGN KEY `body_paint_vehicle_movements_repair_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `body_paint_vehicle_movements` DROP FOREIGN KEY `body_paint_vehicle_movements_to_location_id_fkey`;

-- DropForeignKey
ALTER TABLE `job_cards` DROP FOREIGN KEY `job_cards_branch_id_fkey`;

-- DropForeignKey
ALTER TABLE `job_cards` DROP FOREIGN KEY `job_cards_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `job_cards` DROP FOREIGN KEY `job_cards_customer_id_fkey`;

-- DropForeignKey
ALTER TABLE `job_cards` DROP FOREIGN KEY `job_cards_vehicle_id_fkey`;

-- DropForeignKey
ALTER TABLE `labor_operations` DROP FOREIGN KEY `labor_operations_job_card_id_fkey`;

-- DropForeignKey
ALTER TABLE `labor_operations` DROP FOREIGN KEY `labor_operations_technician_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_estimate_lines` DROP FOREIGN KEY `service_estimate_lines_estimate_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_estimate_lines` DROP FOREIGN KEY `service_estimate_lines_part_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_estimates` DROP FOREIGN KEY `service_estimates_approved_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_estimates` DROP FOREIGN KEY `service_estimates_job_card_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_inspections` DROP FOREIGN KEY `service_inspections_inspector_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_inspections` DROP FOREIGN KEY `service_inspections_job_card_id_fkey`;

-- DropForeignKey
ALTER TABLE `service_invoices` DROP FOREIGN KEY `service_invoices_job_card_id_fkey`;

-- DropForeignKey
ALTER TABLE `technician_assignments` DROP FOREIGN KEY `technician_assignments_job_card_id_fkey`;

-- DropForeignKey
ALTER TABLE `technician_assignments` DROP FOREIGN KEY `technician_assignments_technician_id_fkey`;

-- DropIndex
DROP INDEX `body_paint_damage_assessments_assessor_id_fkey` ON `body_paint_damage_assessments`;

-- DropIndex
DROP INDEX `body_paint_material_consumptions_operation_id_fkey` ON `body_paint_material_consumptions`;

-- DropIndex
DROP INDEX `body_paint_material_consumptions_part_id_fkey` ON `body_paint_material_consumptions`;

-- DropIndex
DROP INDEX `body_paint_operations_technician_id_fkey` ON `body_paint_operations`;

-- DropIndex
DROP INDEX `body_paint_repair_orders_created_by_id_fkey` ON `body_paint_repair_orders`;

-- DropIndex
DROP INDEX `body_paint_repair_orders_customer_id_fkey` ON `body_paint_repair_orders`;

-- DropIndex
DROP INDEX `body_paint_repair_orders_vehicle_id_fkey` ON `body_paint_repair_orders`;

-- DropIndex
DROP INDEX `body_paint_vehicle_movements_from_location_id_fkey` ON `body_paint_vehicle_movements`;

-- DropIndex
DROP INDEX `body_paint_vehicle_movements_moved_by_id_fkey` ON `body_paint_vehicle_movements`;

-- DropIndex
DROP INDEX `body_paint_vehicle_movements_to_location_id_fkey` ON `body_paint_vehicle_movements`;

-- DropIndex
DROP INDEX `job_cards_created_by_id_fkey` ON `job_cards`;

-- DropIndex
DROP INDEX `job_cards_customer_id_fkey` ON `job_cards`;

-- DropIndex
DROP INDEX `job_cards_vehicle_id_fkey` ON `job_cards`;

-- DropIndex
DROP INDEX `labor_operations_technician_id_fkey` ON `labor_operations`;

-- DropIndex
DROP INDEX `service_estimate_lines_estimate_id_fkey` ON `service_estimate_lines`;

-- DropIndex
DROP INDEX `service_estimate_lines_part_id_fkey` ON `service_estimate_lines`;

-- DropIndex
DROP INDEX `service_estimates_approved_by_id_fkey` ON `service_estimates`;

-- DropIndex
DROP INDEX `service_inspections_inspector_id_fkey` ON `service_inspections`;

-- DropIndex
DROP INDEX `technician_assignments_technician_id_fkey` ON `technician_assignments`;

-- AlterTable
ALTER TABLE `fiscal_periods` ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `closed_by_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `journal_entries` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `reversal_of_id` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    MODIFY `posted_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `finance_documents` (
    `id` VARCHAR(191) NOT NULL,
    `document_no` VARCHAR(60) NOT NULL,
    `type` ENUM('RECEIVABLE', 'PAYABLE', 'EXPENSE', 'BANK_TRANSACTION') NOT NULL,
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(120) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `journal_entry_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `finance_documents_document_no_key`(`document_no`),
    UNIQUE INDEX `finance_documents_journal_entry_id_key`(`journal_entry_id`),
    INDEX `finance_documents_source_type_source_id_idx`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receivables` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `due_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `outstanding` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID') NOT NULL DEFAULT 'OPEN',

    UNIQUE INDEX `receivables_document_id_key`(`document_id`),
    INDEX `receivables_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payables` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NULL,
    `due_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `outstanding` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID') NOT NULL DEFAULT 'OPEN',

    UNIQUE INDEX `payables_document_id_key`(`document_id`),
    INDEX `payables_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `expense_date` DATE NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `expense_account_id` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'POSTED', 'REJECTED', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `approved_by_id` VARCHAR(191) NULL,
    `posted_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `expenses_document_id_key`(`document_id`),
    INDEX `expenses_expense_date_idx`(`expense_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `transaction_date` DATE NOT NULL,
    `type` ENUM('RECEIPT', 'PAYMENT', 'TRANSFER', 'FEE', 'ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reference` VARCHAR(120) NULL,
    `status` ENUM('ENTERED', 'RECONCILED', 'VOID') NOT NULL DEFAULT 'ENTERED',
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `bank_transactions_document_id_key`(`document_id`),
    INDEX `bank_transactions_account_id_transaction_date_idx`(`account_id`, `transaction_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reconciliations` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `statement_date` DATE NOT NULL,
    `statement_balance` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('OPEN', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reconciliations_account_id_statement_date_idx`(`account_id`, `statement_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reconciliation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `reconciliation_id` VARCHAR(191) NOT NULL,
    `bank_transaction_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `reconciliation_lines_reconciliation_id_bank_transaction_id_key`(`reconciliation_id`, `bank_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fiscal_period_close_controls` (
    `id` VARCHAR(191) NOT NULL,
    `fiscal_period_id` VARCHAR(191) NOT NULL,
    `checklist` JSON NOT NULL,
    `closed_by_id` VARCHAR(191) NULL,
    `closed_at` DATETIME(3) NULL,

    UNIQUE INDEX `fiscal_period_close_controls_fiscal_period_id_key`(`fiscal_period_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fiscal_periods` ADD CONSTRAINT `fiscal_periods_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversal_of_id_fkey` FOREIGN KEY (`reversal_of_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_estimates` ADD CONSTRAINT `service_estimates_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_estimates` ADD CONSTRAINT `service_estimates_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_estimate_lines` ADD CONSTRAINT `service_estimate_lines_estimate_id_fkey` FOREIGN KEY (`estimate_id`) REFERENCES `service_estimates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_estimate_lines` ADD CONSTRAINT `service_estimate_lines_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `technician_assignments` ADD CONSTRAINT `technician_assignments_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `technician_assignments` ADD CONSTRAINT `technician_assignments_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `labor_operations` ADD CONSTRAINT `labor_operations_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `labor_operations` ADD CONSTRAINT `labor_operations_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_inspections` ADD CONSTRAINT `service_inspections_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_inspections` ADD CONSTRAINT `service_inspections_inspector_id_fkey` FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_invoices` ADD CONSTRAINT `service_invoices_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_repair_orders` ADD CONSTRAINT `body_paint_repair_orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_repair_orders` ADD CONSTRAINT `body_paint_repair_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_repair_orders` ADD CONSTRAINT `body_paint_repair_orders_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_repair_orders` ADD CONSTRAINT `body_paint_repair_orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_insurance_cases` ADD CONSTRAINT `body_paint_insurance_cases_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_damage_assessments` ADD CONSTRAINT `body_paint_damage_assessments_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_damage_assessments` ADD CONSTRAINT `body_paint_damage_assessments_assessor_id_fkey` FOREIGN KEY (`assessor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_approvals` ADD CONSTRAINT `body_paint_approvals_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_operations` ADD CONSTRAINT `body_paint_operations_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_operations` ADD CONSTRAINT `body_paint_operations_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_vehicle_movements` ADD CONSTRAINT `body_paint_vehicle_movements_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_vehicle_movements` ADD CONSTRAINT `body_paint_vehicle_movements_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_vehicle_movements` ADD CONSTRAINT `body_paint_vehicle_movements_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_vehicle_movements` ADD CONSTRAINT `body_paint_vehicle_movements_moved_by_id_fkey` FOREIGN KEY (`moved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_material_consumptions` ADD CONSTRAINT `body_paint_material_consumptions_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_material_consumptions` ADD CONSTRAINT `body_paint_material_consumptions_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_material_consumptions` ADD CONSTRAINT `body_paint_material_consumptions_operation_id_fkey` FOREIGN KEY (`operation_id`) REFERENCES `body_paint_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_paint_invoice_ready_summaries` ADD CONSTRAINT `body_paint_invoice_ready_summaries_repair_order_id_fkey` FOREIGN KEY (`repair_order_id`) REFERENCES `body_paint_repair_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_documents` ADD CONSTRAINT `finance_documents_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_documents` ADD CONSTRAINT `finance_documents_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `finance_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payables` ADD CONSTRAINT `payables_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `finance_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payables` ADD CONSTRAINT `payables_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `finance_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_expense_account_id_fkey` FOREIGN KEY (`expense_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_posted_by_id_fkey` FOREIGN KEY (`posted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `finance_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliations` ADD CONSTRAINT `reconciliations_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliations` ADD CONSTRAINT `reconciliations_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliation_lines` ADD CONSTRAINT `reconciliation_lines_reconciliation_id_fkey` FOREIGN KEY (`reconciliation_id`) REFERENCES `reconciliations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliation_lines` ADD CONSTRAINT `reconciliation_lines_bank_transaction_id_fkey` FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fiscal_period_close_controls` ADD CONSTRAINT `fiscal_period_close_controls_fiscal_period_id_fkey` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fiscal_period_close_controls` ADD CONSTRAINT `fiscal_period_close_controls_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
