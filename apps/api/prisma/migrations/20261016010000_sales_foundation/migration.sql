CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `cnic_hash` CHAR(64) NULL,
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `customers_branch_id_created_at_idx`(`branch_id`, `created_at`),
    INDEX `customers_branch_id_phone_idx`(`branch_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `registration_no` VARCHAR(40) NOT NULL,
    `vin` VARCHAR(80) NULL,
    `make` VARCHAR(80) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `model_year` INTEGER NULL,
    `color` VARCHAR(40) NULL,
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `vehicles_branch_id_registration_no_key`(`branch_id`, `registration_no`),
    INDEX `vehicles_branch_id_vin_idx`(`branch_id`, `vin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(255) NULL,
    `interest` VARCHAR(160) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `leads_branch_id_status_created_at_idx`(`branch_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `vehicle_id` VARCHAR(191) NULL,
    `lead_id` VARCHAR(191) NULL,
    `booking_no` VARCHAR(50) NOT NULL,
    `booking_date` DATETIME(3) NOT NULL,
    `status` ENUM('RESERVED', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'RESERVED',
    `notes` VARCHAR(500) NULL,
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `bookings_branch_id_booking_no_key`(`branch_id`, `booking_no`),
    INDEX `bookings_branch_id_status_booking_date_idx`(`branch_id`, `status`, `booking_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customers` ADD CONSTRAINT `customers_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `customers` ADD CONSTRAINT `customers_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
