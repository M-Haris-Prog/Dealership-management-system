CREATE TABLE `notifications` (
  `id` VARCHAR(191) NOT NULL,
  `recipient_id` VARCHAR(191) NOT NULL,
  `type` VARCHAR(80) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `entity_type` VARCHAR(80) NULL,
  `entity_id` VARCHAR(100) NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `notifications_recipient_id_read_at_created_at_idx`(`recipient_id`, `read_at`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attachments` (
  `id` VARCHAR(191) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `content_type` VARCHAR(160) NOT NULL,
  `size_bytes` INTEGER NOT NULL,
  `checksum` CHAR(64) NOT NULL,
  `uploaded_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `attachments_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attachment_access_logs` (
  `id` VARCHAR(191) NOT NULL,
  `attachment_id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `attachment_access_logs_attachment_id_created_at_idx`(`attachment_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `approval_requests` (
  `id` VARCHAR(191) NOT NULL,
  `workflow` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `requester_id` VARCHAR(191) NOT NULL,
  `approver_id` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(1000) NULL,
  `decision` VARCHAR(1000) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decided_at` DATETIME(3) NULL,
  INDEX `approval_requests_workflow_entity_type_entity_id_status_idx`(`workflow`, `entity_type`, `entity_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_recipient_id_fkey`
  FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `attachments`
  ADD CONSTRAINT `attachments_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;

ALTER TABLE `attachment_access_logs`
  ADD CONSTRAINT `attachment_access_logs_attachment_id_fkey`
  FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `attachment_access_logs_actor_id_fkey`
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;

ALTER TABLE `approval_requests`
  ADD CONSTRAINT `approval_requests_requester_id_fkey`
  FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `approval_requests_approver_id_fkey`
  FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;
