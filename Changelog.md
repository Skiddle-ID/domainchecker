# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Implemented scheduled Worker (`src/worker.ts`) to send Discord webhook notifications every 10 minutes.
- Compiles all unsent domain check batches into a CSV file, sends to Discord, and marks them as sent.
### Added
- Introduced `pending_webhook` table in Turso DB to store domain check batches for Discord notification batching.
- Preparing for Discord webhook notifications to be sent every 10 minutes instead of per-check, to reduce spam.
### Added
- Added Discord webhook integration: after each domain check batch, results are sent as a plain text message to a configurable Discord webhook URL (`DISCORD_WEBHOOK_URL` in env).
- Created `src/webhook.ts` utility for sending messages to Discord webhooks.
- Updated `/check` endpoint logic to send summary of results to Discord if webhook is configured.

### Changed
- Awaited the Discord webhook call in the `/check` endpoint to ensure the request completes before the Worker finishes. Improved error logging for webhook failures.
- Discord webhook now sends results as an embed if 5 or fewer domains are checked, or as a text file attachment if more than 5 domains are checked.

