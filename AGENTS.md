# AGENTS instructions

## Commands

- Build project: `npm run build`
- Run linter: `npm run lint`
- Fix issues reported by linter: `npm run lint:fix`
- Run unit tests: `npm run test`
- Clean workspace: `npm run clean`
- Create a pull request: `gh pr create --web --title <PR title> --body <PR body>`

## Standard build workflow

1. Run linter
2. Fix issues reported by linter, if any - otherwise skip.
3. Build project
4. Run unit tests

## Coding guidelines

- TypeScript strict mode
- Single quotes, spaces instead of tabs
- Follow [Google TypeScript style guide](https://google.github.io/styleguide/tsguide.html).
- Follow the [single-responsibility principle](https://en.wikipedia.org/wiki/Single-responsibility_principle) for classes and functions.
- Make sure exceptions are handled explicitly.
- Include comprehensive unit tests. Aim for 100% coverage.

## Commit guidelines

- Follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/).
- Use commit message body to explain what and why vs. how - see <https://chris.beams.io/git-commit#why-not-how>.
- Add relevant issue or PR links, commit SHAs etc. to commit message footer.
- Always ensure the project builds and tests succeed before committing.
- NEVER push to `main` branch directly - always put changes on a feature branch and create a pull request. The only exception to this rule is merging `upstream` changes into `main` branch.

## Boundaries

**Ask first:**

- Large refactoring
- New dependencies with broad impact
- Destructive data or migration changes

**Never:**

- Commit secrets, credentials, tokens or any other sensitive data
- Edit generated files by hand when a generation workflow exists
- Use destructive git operations unless explicitly requested
