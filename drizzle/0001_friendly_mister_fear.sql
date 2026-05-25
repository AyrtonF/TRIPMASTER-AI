CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`inputText` text NOT NULL,
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`currentAgent` varchar(64),
	`context` json,
	`result` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
