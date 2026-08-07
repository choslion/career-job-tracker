# Repository Guide

## Purpose

This repository contains a local-first job application dashboard built with Next.js and TypeScript.
It reads application documents from the separate `career-workbench` repository.

## Data boundary

- Treat the mounted career data directory as read-only.
- Never copy real resumes, cover letters, profile photos, contact details, or application documents into this repository.
- Use only fictional fixtures under `fixtures/` for development and tests.
- Never expose an absolute host filesystem path to browser code or API responses.
- Do not modify the `career-workbench` repository while implementing this application.

## Implementation conventions

- Put the application under `web/`.
- Use Next.js App Router, TypeScript, and Korean UI copy.
- Keep filesystem parsing in server-only modules.
- Keep Docker and Docker Compose suitable for local development on Windows and macOS.
- Do not add a database, authentication, scraping, or write-back features unless an issue explicitly expands the scope.

## Verification

Before handing off changes, run the available lint, unit test, build, and Docker Compose configuration checks. Document any check that cannot run.
