CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_user_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`allow_guest_reorder` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`host_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_code_idx` ON `room` (`code`);--> statement-breakpoint
CREATE TABLE `room_song` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`video_id` text NOT NULL,
	`singer_nickname` text NOT NULL,
	`added_by_user_id` text,
	`played_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `song`(`video_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`normalized_query` text NOT NULL,
	`user_id` text,
	`room_id` text,
	`picked_video_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`picked_video_id`) REFERENCES `song`(`video_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `search_log_normalized_query_idx` ON `search_log` (`normalized_query`);--> statement-breakpoint
CREATE TABLE `song` (
	`video_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`embeddable` integer NOT NULL,
	`duration_seconds` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `is_anonymous` integer;