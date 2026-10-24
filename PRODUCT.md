# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-approved recommendation: TypeScript, Discord.js, React with Vite, one backend for the dashboard and Discord gateway, persistent SQLite, Docker deployment.

## Users

Branilist users in Discord communities, and server managers configuring the integration.

## Product Purpose

Branilist Bot brings anime/manga search, Branilist profiles and account features into Discord. Its multilingual website explains the bot, and its dashboard lets authorized managers configure each server.

## Positioning

Use the published @aniyan-project/branilist-api npm SDK as the GraphQL integration; keep account permissions and privacy enforced by Branilist.

## Operating Context

Prefix and slash commands; Discord login for dashboard access; optional Branilist account linking for user-authorized features. Server settings persist independently. Initial languages are Portuguese, English and Spanish.

## Capabilities and Constraints

Public open-source repository Aniyan-Project/Discord-bot. Prefix is configurable. Genuine deployment requires operator-owned Discord and Branilist OAuth credentials. No credentials or production adoption metrics have been supplied. A local demo must be clearly identified and must not claim a live connection.

- Authorized server managers can compose classic embeds or Components V2 with a live preview, authenticated variables, JSON import/export and SQLite drafts scoped to their user and server, then review delivery through the bot or a managed webhook. The creator supports Portuguese, English and Spanish; demo sends remain simulated.

## Brand Commitments

Name confirmed by the user: Branilist Bot. Use delfus.app and the supplied dashboard screenshot as inspiration for navigation and configuration organization; do not copy its design, mascot, wording or unrelated moderation features.

## Evidence on Hand

Published SDK 0.1.0 and Branilist public schema/docs. User-supplied dashboard screenshot. No bot branding assets, customer testimonials or production bot credentials supplied.

## Product Principles

- Make useful Branilist interactions available in Discord through a shared command implementation.
- Keep server administration distinct from personal account authorization.
- Preserve privacy, communicate missing scopes and never expose access tokens to the browser.
- Keep bot, website and dashboard understandable in all initial languages.
- Make installation and configuration reproducible for self-hosting.
