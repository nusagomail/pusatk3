CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`provider_id` text NOT NULL,
	`schedule_id` text,
	`user_id` text,
	`channel` text NOT NULL,
	`name` text,
	`phone` text,
	`email` text,
	`message` text,
	`consent_at` integer,
	`consent_version` text,
	`anonymized_at` integer,
	`status` text DEFAULT 'new' NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leads_channel_check" CHECK("leads"."channel" IN ('whatsapp', 'form')),
	CONSTRAINT "leads_status_check" CHECK("leads"."status" IN ('new', 'contacted', 'registered', 'closed')),
	CONSTRAINT "leads_personal_data_check" CHECK(("leads"."channel" = 'whatsapp' AND "leads"."name" IS NULL AND "leads"."phone" IS NULL AND "leads"."email" IS NULL AND "leads"."message" IS NULL AND "leads"."consent_at" IS NULL AND "leads"."consent_version" IS NULL)
        OR ("leads"."channel" = 'form' AND ("leads"."anonymized_at" IS NOT NULL OR ("leads"."consent_at" IS NOT NULL AND "leads"."consent_version" IS NOT NULL AND "leads"."name" IS NOT NULL AND "leads"."message" IS NOT NULL AND ("leads"."phone" IS NOT NULL OR "leads"."email" IS NOT NULL)))))
);
--> statement-breakpoint
CREATE INDEX `leads_provider_created_idx` ON `leads` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_schedule_id_idx` ON `leads` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `leads_created_at_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE TABLE `profile_views` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`provider_id` text NOT NULL,
	`schedule_id` text DEFAULT '' NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profile_views_day_check" CHECK("profile_views"."day" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "profile_views_count_check" CHECK("profile_views"."count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_views_key_unique` ON `profile_views` (`provider_id`,`schedule_id`,`day`);