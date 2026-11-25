CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`province` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_slug_unique` ON `cities` (`slug`);--> statement-breakpoint
CREATE TABLE `course_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`field_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`issuers` text NOT NULL,
	`document_type` text NOT NULL,
	`typical_validity_years` integer,
	`regulation_ref` text NOT NULL,
	`synonyms` text NOT NULL,
	FOREIGN KEY (`field_id`) REFERENCES `course_fields`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_categories_slug_unique` ON `course_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `course_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_fields_slug_unique` ON `course_fields` (`slug`);