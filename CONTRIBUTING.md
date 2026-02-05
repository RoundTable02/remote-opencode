# Contributing to remote-opencode

First off, thank you for considering contributing to remote-opencode! Every contribution helps make this project better for everyone.

## Before You Start

### Open an Issue First

Before starting work on a new feature or significant change, **please open an issue first** to discuss it. This helps:

- Ensure your idea aligns with the project's direction
- Avoid duplicate work if someone else is already working on it
- Get early feedback that might save you time

For bug fixes, feel free to open a PR directly if the fix is straightforward.

### What the Maintainer Handles

To keep things organized, the following are managed by the maintainer:

- **Version bumps** (`package.json`, `CHANGELOG.md`)
- **Release notes and changelog entries**

Please **do not include version changes** in your PRs. Focus on the code changes themselves, and the maintainer will handle versioning during the release process.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/RoundTable02/remote-opencode/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Your environment (OS, Node.js version, etc.)

### Suggesting Features

1. Open an issue describing your idea
2. Explain the use case and why it would be valuable
3. Wait for feedback before starting implementation

### Submitting Pull Requests

1. **Fork** the repository
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** with clear, focused commits
4. **Test your changes** locally:
   ```bash
   npm test
   npm run build
   ```
5. **Push** to your fork and open a PR

#### PR Guidelines

- **One feature/fix per PR** — Keep PRs focused and easy to review
- **Write clear commit messages** — Describe what and why
- **Update documentation** if your change affects user-facing behavior
- **Do not bump versions** — Leave `package.json` version and `CHANGELOG.md` updates to the maintainer

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/remote-opencode.git
cd remote-opencode

# Install dependencies
npm install

# Run in development mode
npm run dev start

# Run tests
npm test

# Build for production
npm run build
```

## Code Style

- This project uses TypeScript
- Follow the existing code patterns you see in the codebase
- Run `npm run build` to ensure there are no type errors

## Questions?

Feel free to open an issue if you have any questions. We're happy to help!

---

Thank you for contributing!
