# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run tests**: `npm test`
- **Run tests in watch mode**: `npm run test:watch`  
- **Run tests with coverage**: `npm run test:coverage`
- **Install dependencies**: `npm install`

## Code Architecture

This is a Node.js CLI application for managing uuCloud deployments. The application follows a command pattern with dependency injection.

### Entry Point and Structure
- **Main entry**: `index.js` - Sets development environment and bootstraps the application
- **Core CLI logic**: `src/uuCloudCli.js` - Handles command parsing, shortcuts, and command routing
- **Commands**: Located in `src/commands/` - Each command implements the Command interface
  - `PsCommand.js` - Lists deployed applications  
  - `LogsCommand.js` - Fetches application logs with various output formats
  - `UseCommand.js` - Sets default configuration values
  - `InteractiveCommand.js` - Interactive mode for app selection
  - `ExecuteCommand.js` - Executes commands with specified paths and parameters

### Dependency Injection
- **Container setup**: `src/di/container-setup.js` - Configures the DI container
- **Container**: `src/di/Container.js` - Simple DI container implementation
- **Interfaces**: `src/interfaces/` - Define contracts for services
- **Implementations**: `src/implementations/` - Concrete implementations of interfaces

### Key Services
- **CloudClient**: Interfaces with uuCloud APIs (`src/uucloud/`)
- **LogStore**: Handles log fetching from various log stores (`src/platform/`)
- **TokenProvider**: Manages OIDC authentication (`src/oidc-token-provider.js`)
- **Console**: Output formatting and display (`src/implementations/RealConsole.js`, `GanttConsole.js`)

### Configuration System
- **Config**: `src/misc/config.js` - Centralized configuration management
- **Presets**: Support for named configuration presets in config.json
- **Shortcuts**: Command shortcuts defined in configuration
- **Option formats**: Supports both kebab-case (`--resource-pool`) and camelCase (`--resourcePool`) options

### Testing
- Test files located in `test/` directory with `.test.js` extension
- Uses Jest testing framework
- Mock implementations available in `test/mocks/`
- Coverage reports generated in `coverage/` directory

### Special Features
- **Gantt codec**: Special log visualization mode for ACCESS_LOG records
- **Multiple output formats**: Support for various log output codecs (json, jsonstream, gantt)
- **Log filtering**: Server-side and client-side log filtering capabilities
- **Interactive mode**: Terminal UI for application selection and management
- **Authentication**: OIDC-based authentication with vault support
- **Multi-environment**: Support for different uuCloud environments via configuration

## Important Notes

- The application uses a config profile system - development profile is set by default in index.js
- Command-line arguments are normalized from camelCase to kebab-case for consistency
- The CLI supports both stable and beta update notifications via npm
- All services are injected via the DI container for testability
- Configuration supports presets and shortcuts for common operations