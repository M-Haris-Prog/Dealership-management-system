ALTER TABLE `users`
  ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `mfa_secret` VARCHAR(255) NULL;

CREATE TABLE `refresh_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` DATETIME(3) NULL,
  `replaced_by` VARCHAR(191) NULL,
  UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
  INDEX `refresh_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `number_sequences` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(80) NOT NULL,
  `prefix` VARCHAR(30) NOT NULL,
  `next_value` INTEGER NOT NULL DEFAULT 1,
  `padding` INTEGER NOT NULL DEFAULT 4,
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `number_sequences_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
