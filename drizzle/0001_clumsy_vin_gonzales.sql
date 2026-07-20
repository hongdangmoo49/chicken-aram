CREATE TABLE `match_players` (
	`match_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`team` text NOT NULL,
	`separated_group` integer,
	PRIMARY KEY(`match_id`, `player_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`player_id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`thumbnail_key` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_email_unique` ON `player_profiles` (`email`);