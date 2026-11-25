CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`city_id` text NOT NULL,
	`address` text NOT NULL,
	`lat` real,
	`lng` real,
	`is_main` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "branches_is_main_check" CHECK("branches"."is_main" IN (0, 1)),
	CONSTRAINT "branches_coordinates_check" CHECK(("branches"."lat" IS NULL AND "branches"."lng" IS NULL) OR (typeof("branches"."lat") = 'real' AND typeof("branches"."lng") = 'real' AND "branches"."lat" BETWEEN -90 AND 90 AND "branches"."lng" BETWEEN -180 AND 180))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_id_provider_id_unique` ON `branches` (`id`,`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `branches_provider_id_name_unique` ON `branches` (`provider_id`,`name`);--> statement-breakpoint
CREATE INDEX `branches_city_id_idx` ON `branches` (`city_id`);--> statement-breakpoint
CREATE TABLE `provider_licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`provider_id` text NOT NULL,
	`kind` text NOT NULL,
	`number` text NOT NULL,
	`issuer` text NOT NULL,
	`document_key` text,
	`valid_until` text,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "provider_licenses_kind_check" CHECK("provider_licenses"."kind" IN ('izin_pjk3', 'lisensi_lsp', 'tuk')),
	CONSTRAINT "provider_licenses_valid_until_check" CHECK("provider_licenses"."valid_until" IS NULL OR "provider_licenses"."valid_until" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_licenses_provider_kind_number_unique` ON `provider_licenses` (`provider_id`,`kind`,`number`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`logo_key` text,
	`whatsapp` text,
	`email` text,
	`phone` text,
	`website` text,
	`status` text DEFAULT 'unclaimed' NOT NULL,
	`verification_status` text DEFAULT 'none' NOT NULL,
	`verified_at` integer,
	`plan` text DEFAULT 'free' NOT NULL,
	CONSTRAINT "providers_type_check" CHECK("providers"."type" IN ('pjk3', 'lsp', 'tuk')),
	CONSTRAINT "providers_status_check" CHECK("providers"."status" IN ('unclaimed', 'claimed', 'closed')),
	CONSTRAINT "providers_verification_status_check" CHECK("providers"."verification_status" IN ('none', 'pending', 'verified', 'suspended')),
	CONSTRAINT "providers_plan_check" CHECK("providers"."plan" IN ('free', 'pro', 'business'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_slug_unique` ON `providers` (`slug`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`provider_id` text NOT NULL,
	`branch_id` text,
	`category_id` text NOT NULL,
	`title` text NOT NULL,
	`issuer` text NOT NULL,
	`mode` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`price_idr` integer,
	`quota` integer,
	`description` text,
	`requirements` text,
	`level` text,
	`certificate_kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `course_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`,`provider_id`) REFERENCES `branches`(`id`,`provider_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "schedules_issuer_check" CHECK("schedules"."issuer" IN ('kemnaker', 'bnsp', 'pupr', 'esdm', 'intl')),
	CONSTRAINT "schedules_mode_check" CHECK("schedules"."mode" IN ('offline', 'online')),
	CONSTRAINT "schedules_status_check" CHECK("schedules"."status" IN ('draft', 'published', 'expired')),
	CONSTRAINT "schedules_certificate_kind_check" CHECK("schedules"."certificate_kind" IN ('official', 'training_only')),
	CONSTRAINT "schedules_dates_check" CHECK("schedules"."start_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND "schedules"."end_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND "schedules"."end_date" >= "schedules"."start_date"),
	CONSTRAINT "schedules_branch_check" CHECK(("schedules"."mode" = 'offline' AND "schedules"."branch_id" IS NOT NULL) OR ("schedules"."mode" = 'online' AND "schedules"."branch_id" IS NULL)),
	CONSTRAINT "schedules_price_check" CHECK("schedules"."price_idr" IS NULL OR (typeof("schedules"."price_idr") = 'integer' AND "schedules"."price_idr" >= 0)),
	CONSTRAINT "schedules_quota_check" CHECK("schedules"."quota" IS NULL OR (typeof("schedules"."quota") = 'integer' AND "schedules"."quota" >= 1))
);
--> statement-breakpoint
CREATE INDEX `schedules_status_start_date_idx` ON `schedules` (`status`,`start_date`);--> statement-breakpoint
CREATE INDEX `schedules_provider_id_idx` ON `schedules` (`provider_id`);--> statement-breakpoint
CREATE INDEX `schedules_category_id_idx` ON `schedules` (`category_id`);--> statement-breakpoint
CREATE INDEX `schedules_branch_id_idx` ON `schedules` (`branch_id`);