ALTER TABLE `vehicles`
    ADD COLUMN `sale_price` DECIMAL(18,4) NULL,
    ADD COLUMN `availability` ENUM('AVAILABLE', 'RESERVED', 'ALLOCATED', 'SOLD') NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE `bookings`
    MODIFY `status` ENUM('RESERVED', 'CONFIRMED', 'INVOICED', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'RESERVED',
    ADD COLUMN `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN `discount_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN `approval_status` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN `allocation_status` ENUM('UNALLOCATED', 'ALLOCATED', 'RELEASED') NOT NULL DEFAULT 'UNALLOCATED';

CREATE TABLE `sales_lead_activities` (
    `id` VARCHAR(191) NOT NULL,
    `lead_id` VARCHAR(191) NOT NULL,
    `type` ENUM('FOLLOW_UP', 'NOTE', 'CALL', 'EMAIL', 'SMS', 'MEETING') NOT NULL,
    `status` ENUM('OPEN', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `subject` VARCHAR(160) NULL,
    `notes` VARCHAR(1000) NOT NULL,
    `due_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `sales_lead_activities_lead_id_status_due_at_idx`(`lead_id`, `status`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `booking_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `from_status` ENUM('RESERVED', 'CONFIRMED', 'INVOICED', 'DELIVERED', 'COMPLETED', 'CANCELLED') NULL,
    `to_status` ENUM('RESERVED', 'CONFIRMED', 'INVOICED', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL,
    `note` VARCHAR(500) NULL,
    `changed_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `booking_status_history_booking_id_created_at_idx`(`booking_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `booking_documents` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `document_type` VARCHAR(80) NOT NULL,
    `attachment_id` VARCHAR(191) NULL,
    `reference_no` VARCHAR(120) NULL,
    `notes` VARCHAR(500) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `booking_documents_booking_id_document_type_idx`(`booking_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_payment_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `installment_no` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `amount` DECIMAL(18,4) NOT NULL,
    `paid_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `notes` VARCHAR(500) NULL,
    UNIQUE INDEX `sales_payment_schedules_booking_id_installment_no_key`(`booking_id`, `installment_no`),
    INDEX `sales_payment_schedules_booking_id_status_due_date_idx`(`booking_id`, `status`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `invoice_no` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(18,4) NOT NULL,
    `tax` DECIMAL(18,4) NOT NULL DEFAULT 0,
    `total` DECIMAL(18,4) NOT NULL,
    `finance_document_id` VARCHAR(191) NULL,
    `journal_entry_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `posted_at` DATETIME(3) NULL,
    UNIQUE INDEX `sales_invoices_invoice_no_key`(`invoice_no`),
    UNIQUE INDEX `sales_invoices_finance_document_id_key`(`finance_document_id`),
    UNIQUE INDEX `sales_invoices_journal_entry_id_key`(`journal_entry_id`),
    INDEX `sales_invoices_booking_id_status_idx`(`booking_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_payments` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NULL,
    `payment_no` VARCHAR(60) NOT NULL,
    `type` ENUM('RECEIPT', 'REFUND') NOT NULL DEFAULT 'RECEIPT',
    `status` ENUM('RECORDED', 'ALLOCATED', 'REFUNDED') NOT NULL DEFAULT 'RECORDED',
    `amount` DECIMAL(18,4) NOT NULL,
    `payment_method` VARCHAR(40) NOT NULL,
    `reference` VARCHAR(120) NULL,
    `journal_entry_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `sales_payments_payment_no_key`(`payment_no`),
    INDEX `sales_payments_booking_id_type_created_at_idx`(`booking_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `delivery_no` VARCHAR(60) NOT NULL,
    `status` ENUM('SCHEDULED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `delivered_at` DATETIME(3) NULL,
    `delivered_to` VARCHAR(160) NULL,
    `notes` VARCHAR(500) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `sales_deliveries_delivery_no_key`(`delivery_no`),
    INDEX `sales_deliveries_booking_id_status_idx`(`booking_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `booking_requests` (
    `id` VARCHAR(191) NOT NULL,
    `booking_id` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOKING_APPROVAL', 'CANCELLATION', 'REFUND', 'DEDUCTION', 'DISCOUNT', 'ALLOCATION_CHANGE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(1000) NOT NULL,
    `amount` DECIMAL(18,4) NULL,
    `metadata` JSON NULL,
    `requester_id` VARCHAR(191) NOT NULL,
    `approver_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decided_at` DATETIME(3) NULL,
    INDEX `booking_requests_booking_id_type_status_idx`(`booking_id`, `type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_lead_activities` ADD CONSTRAINT `sales_lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_lead_activities` ADD CONSTRAINT `sales_lead_activities_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `booking_documents` ADD CONSTRAINT `booking_documents_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `booking_documents` ADD CONSTRAINT `booking_documents_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_payment_schedules` ADD CONSTRAINT `sales_payment_schedules_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_finance_document_id_fkey` FOREIGN KEY (`finance_document_id`) REFERENCES `finance_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `sales_payment_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_deliveries` ADD CONSTRAINT `sales_deliveries_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_deliveries` ADD CONSTRAINT `sales_deliveries_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
