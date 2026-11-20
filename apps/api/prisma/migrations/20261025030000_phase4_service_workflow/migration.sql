CREATE TABLE `service_packages` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `price` DECIMAL(18,4) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `service_packages_code_key`(`code`),
    INDEX `service_packages_status_name_idx`(`status`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `job_cards`
    ADD COLUMN `package_id` VARCHAR(191) NULL,
    ADD COLUMN `is_warranty` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `warranty_ref` VARCHAR(120) NULL;

CREATE TABLE `service_check_events` (
    `id` VARCHAR(191) NOT NULL,
    `job_card_id` VARCHAR(191) NOT NULL,
    `type` ENUM('CHECK_IN', 'CHECK_OUT') NOT NULL,
    `event_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `odometer` INTEGER NULL,
    `fuel_level` VARCHAR(40) NULL,
    `notes` VARCHAR(1000) NULL,
    `checklist` JSON NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    INDEX `service_check_events_job_card_id_type_event_at_idx`(`job_card_id`, `type`, `event_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `service_invoices`
    ADD COLUMN `finance_document_id` VARCHAR(191) NULL,
    ADD UNIQUE INDEX `service_invoices_finance_document_id_key`(`finance_document_id`);

ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `service_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `service_check_events` ADD CONSTRAINT `service_check_events_job_card_id_fkey` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_invoices` ADD CONSTRAINT `service_invoices_finance_document_id_fkey` FOREIGN KEY (`finance_document_id`) REFERENCES `finance_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
