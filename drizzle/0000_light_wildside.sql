CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scheduled_at` text NOT NULL,
	`map` text NOT NULL,
	`status` text NOT NULL,
	`team_red` text NOT NULL,
	`team_blue` text NOT NULL,
	`red_score` integer,
	`blue_score` integer,
	`mvp` text,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`tier` integer NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_nickname_unique` ON `players` (`nickname`);