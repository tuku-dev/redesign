# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains no application code, tests, assets, or build configuration. Keep the root focused on project documentation and configuration as implementation begins. Organize source code, tests, and static assets into clearly named directories appropriate to the chosen framework, and update this guide with their actual locations. Avoid adding empty directories solely to establish a speculative structure.

## Build, Test, and Development Commands

No development, build, lint, or test commands are configured yet. When adding the initial toolchain, provide reproducible commands in the project configuration and document them in `README.md`. Explain prerequisites, dependency installation, local development, production builds, and test execution. Do not assume commands such as `npm test` work until the corresponding configuration exists.

## Coding Style & Naming Conventions

Follow the conventions of the language and framework selected for the project. Use consistent indentation, descriptive identifiers, and filenames that communicate each module’s purpose. Add a formatter and linter when introducing source code, and commit their configuration so contributors share the same rules. Keep changes focused; avoid unrelated formatting edits.

## Testing Guidelines

No testing framework or coverage threshold has been established. Add automated tests alongside new behavior once a framework is selected. Use descriptive test names that explain the expected behavior, and cover relevant failure cases. Document test locations, naming patterns, and execution commands when the first tests are introduced.

## Commit & Pull Request Guidelines

No Git history is available to establish existing commit conventions. Use concise, imperative commit subjects, such as `Add initial application scaffold`. Keep each commit focused on one logical change. Pull requests should describe the change, explain its purpose, link related issues where applicable, and list validation performed. Include screenshots for visible interface changes and disclose checks that could not be run.

## Security & Configuration

Never commit credentials, access tokens, or private configuration. When environment variables are introduced, document required names and provide an example configuration containing placeholder values.