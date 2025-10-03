#!/usr/bin/env node

/**
 * PROTOTYPE: Interactive Log Viewer with Vi-Style Command Mode
 * 
 * This is a standalone prototype demonstrating the interactive log viewer concept.
 * 
 * Usage:
 *   node prototype-interactive-logs.js
 * 
 * Features:
 *   - Displays streaming logs in a scrollable view
 *   - Press ':' to enter command mode
 *   - Use ?regexp? to filter logs (e.g., :?ERROR? or :?timeout?)
 *   - Press 'q' to quit
 *   - Arrow keys / Page Up/Down to scroll
 *   - ESC to exit command mode
 * 
 * Commands:
 *   :?pattern?     - Filter logs matching regex pattern
 *   :clear or :c   - Clear filter, show all logs
 *   :q or :quit    - Quit the viewer
 */

const blessed = require('blessed');
const chalk = require('chalk');

// Suppress blessed terminal warnings about unsupported features
process.on('warning', (warning) => {
  if (warning.message && warning.message.includes('xterm')) {
    // Suppress xterm-related warnings
    return;
  }
  console.warn(warning);
});

class InteractiveLogViewer {
  constructor(options = {}) {
    this.options = options;
    this.allLogs = [];
    this.filteredLogs = [];
    this.currentFilter = null;
    this.mode = 'NORMAL'; // NORMAL or COMMAND
    this.commandBuffer = '';
    this.logCounter = 0;
    this.isRunning = true;
    
    this.initializeUI();
    this.setupKeyBindings();
  }

  initializeUI() {
    // Temporarily suppress stderr during screen creation to hide terminal capability warnings
    const originalStderrWrite = process.stderr.write;
    process.stderr.write = () => {};
    
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Interactive Log Viewer - Prototype',
      fullUnicode: true,
      dockBorders: true,
      ignoreLocked: ['C-c'],
      // Avoid problematic terminal features
      warnings: false,
      // Force simpler terminal handling to avoid escape sequence issues
      forceUnicode: true
    });
    
    // Restore stderr after screen creation
    process.stderr.write = originalStderrWrite;

    // Main log display area (no border, vi-like)
    this.logBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-2',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          ch: ' '
        },
        style: {
          inverse: true
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Status bar (vi-like inverse video)
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      content: this.getStatusText(),
      tags: true,
      style: {
        bg: 'white',
        fg: 'black',
        bold: true
      }
    });

    // Command line (vi-like)
    this.commandLine = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      inputOnFocus: true,
      style: {
        bg: 'black',
        fg: 'white'
      }
    });

    this.screen.render();
  }

  setupKeyBindings() {
    // Main screen key bindings (NORMAL mode)
    this.screen.key(['q'], () => {
      if (this.mode === 'NORMAL') {
        this.quit();
      }
    });

    this.screen.key(['escape'], () => {
      if (this.mode === 'COMMAND') {
        this.exitCommandMode();
      }
    });

    this.screen.key([':'], () => {
      if (this.mode === 'NORMAL') {
        this.enterCommandMode();
      }
    });

    this.screen.key(['/'], () => {
      if (this.mode === 'NORMAL') {
        this.enterCommandMode(':/');
      }
    });

    // Scroll bindings
    this.screen.key(['up', 'k'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.scroll(-1);
        this.screen.render();
      }
    });

    this.screen.key(['down', 'j'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.scroll(1);
        this.screen.render();
      }
    });

    this.screen.key(['pageup'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.scroll(-10);
        this.screen.render();
      }
    });

    this.screen.key(['pagedown'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.scroll(10);
        this.screen.render();
      }
    });

    this.screen.key(['home', 'g'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.setScrollPerc(0);
        this.screen.render();
      }
    });

    this.screen.key(['end', 'G'], () => {
      if (this.mode === 'NORMAL') {
        this.logBox.setScrollPerc(100);
        this.screen.render();
      }
    });

    // Command line bindings
    this.commandLine.key(['enter'], () => {
      const command = this.commandLine.getValue();
      this.handleCommand(command);
      this.exitCommandMode();
    });

    // Exit on Ctrl+C
    this.screen.key(['C-c'], () => {
      this.quit();
    });
  }

  enterCommandMode(prefix = ':') {
    this.mode = 'COMMAND';
    this.commandBuffer = '';
    this.commandLine.setValue(prefix);
    this.commandLine.focus();
    this.updateStatusBar();
    this.screen.render();
  }

  exitCommandMode() {
    this.mode = 'NORMAL';
    this.commandLine.setValue('');
    this.commandLine.clearValue();
    this.logBox.focus();
    this.updateStatusBar();
    this.screen.render();
  }

  handleCommand(command) {
    if (!command || command.length === 0) {
      return;
    }

    // Remove leading : or /
    command = command.replace(/^[:\/]/, '').trim();

    if (!command) {
      return;
    }

    // Parse command
    if (command === 'q' || command === 'quit') {
      this.quit();
    } else if (command === 'clear' || command === 'c') {
      this.clearFilter();
    } else {
      // Try to parse as filter pattern - ONLY with ?pattern? or /pattern/ syntax
      let pattern = null;
      
      if (command.match(/^\?(.+)\?$/)) {
        // ?pattern? syntax (complete)
        pattern = command.match(/^\?(.+)\?$/)[1];
      } else if (command.match(/^\/(.+)\/$/)) {
        // /pattern/ syntax (complete)
        pattern = command.match(/^\/(.+)\/$/)[1];
      } else if (command.match(/^\?(.+)$/)) {
        // ?pattern syntax (without trailing ?) - allow this too
        pattern = command.match(/^\?(.+)$/)[1];
      } else if (command.match(/^\/(.+)$/)) {
        // /pattern syntax (without trailing /) - allow this too
        pattern = command.match(/^\/(.+)$/)[1];
      } else {
        // Unknown command
        this.showError('Unknown command: ' + command + ' (use :?pattern? to filter, :clear to clear, :q to quit)');
        return;
      }

      if (pattern) {
        this.applyFilter(pattern);
      }
    }
  }

  applyFilter(pattern) {
    try {
      this.currentFilter = new RegExp(pattern, 'i');
      this.filteredLogs = this.allLogs.filter(log => 
        this.currentFilter.test(log.message)
      );
      this.updateDisplay();
      this.updateStatusBar();
    } catch (e) {
      this.showError(`Invalid regex pattern: ${e.message}`);
    }
  }

  clearFilter() {
    this.currentFilter = null;
    this.filteredLogs = [];
    this.updateDisplay();
    this.updateStatusBar();
  }

  addLog(logEntry) {
    // Don't add logs if viewer is shutting down
    if (!this.isRunning) {
      return;
    }
    
    this.logCounter++;
    this.allLogs.push(logEntry);
    
    // If filter is active, check if this log matches
    if (this.currentFilter) {
      if (this.currentFilter.test(logEntry.message)) {
        this.filteredLogs.push(logEntry);
        this.updateDisplay();
      }
    } else {
      this.updateDisplay();
    }
    
    this.updateStatusBar();
  }

  updateDisplay() {
    // Don't update if viewer is shutting down
    if (!this.isRunning) {
      return;
    }
    
    const logsToDisplay = this.currentFilter ? this.filteredLogs : this.allLogs;
    
    const content = logsToDisplay
      .map(log => this.formatLog(log))
      .join('\n');
    
    this.logBox.setContent(content);
    
    // Auto-scroll to bottom if we're near the bottom
    try {
      const scrollPerc = this.logBox.getScrollPerc();
      if (scrollPerc === 100 || scrollPerc >= 95) {
        this.logBox.setScrollPerc(100);
      }
    } catch (e) {
      // Ignore scroll errors during shutdown
    }
    
    this.screen.render();
  }

  formatLog(log) {
    const timestamp = log.timestamp.toISOString();
    const level = this.colorizeLogLevel(log.level);
    
    // Highlight matched pattern if filter is active
    let message = log.message;
    if (this.currentFilter) {
      message = message.replace(this.currentFilter, (match) => {
        return '{yellow-bg}{black-fg}' + match + '{/black-fg}{/yellow-bg}';
      });
    }
    
    return '{gray-fg}' + timestamp + '{/gray-fg} ' + level + ' {white-fg}' + message + '{/white-fg}';
  }

  colorizeLogLevel(level) {
    switch (level) {
      case 'ERROR':
        return '{red-fg}{bold}ERROR{/bold}{/red-fg}';
      case 'WARN':
        return '{yellow-fg}{bold}WARN {/bold}{/yellow-fg}';
      case 'INFO':
        return '{cyan-fg}{bold}INFO {/bold}{/cyan-fg}';
      case 'DEBUG':
        return '{gray-fg}{bold}DEBUG{/bold}{/gray-fg}';
      default:
        return '{white-fg}{bold}' + level + '{/bold}{/white-fg}';
    }
  }

  updateStatusBar() {
    // Don't update if viewer is shutting down
    if (!this.isRunning) {
      return;
    }
    
    this.statusBar.setContent(this.getStatusText());
    this.screen.render();
  }

  getStatusText() {
    // Vi-like status line format (mode on left, info on right)
    const mode = this.mode === 'COMMAND' ? '-- COMMAND --' : '';
    
    const filterInfo = this.currentFilter ? 
      ' [Filter: ' + this.currentFilter.source + ']' : '';
    
    const displayCount = this.currentFilter ? this.filteredLogs.length : this.allLogs.length;
    const totalCount = this.allLogs.length;
    
    const countInfo = this.currentFilter ?
      ' ' + displayCount + '/' + totalCount + ' logs' :
      ' ' + totalCount + ' logs';
    
    // Build status line
    let status = ' ' + mode;
    if (this.mode === 'NORMAL') {
      status = filterInfo + countInfo;
    }
    
    return status;
  }

  showError(message) {
    // Temporarily show error in status bar (vi-like)
    const originalContent = this.statusBar.content;
    this.statusBar.setContent(' ERROR: ' + message);
    this.screen.render();
    
    setTimeout(() => {
      this.statusBar.setContent(originalContent);
      this.screen.render();
    }, 3000);
  }

  quit() {
    // Set flag immediately to stop all updates
    if (!this.isRunning) {
      return; // Already quitting
    }
    this.isRunning = false;
    
    // Temporarily suppress stderr during cleanup to avoid blessed terminal warnings
    const originalStderrWrite = process.stderr.write;
    process.stderr.write = () => {};
    
    // Clean up screen properly
    try {
      // Reset to normal mode
      if (this.logBox) this.logBox.detach();
      if (this.statusBar) this.statusBar.detach();
      if (this.commandLine) this.commandLine.detach();
      
      // Clear screen and destroy
      if (this.screen) {
        this.screen.clearRegion(0, this.screen.width, 0, this.screen.height);
        this.screen.destroy();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Restore stderr
    process.stderr.write = originalStderrWrite;
    
    // Give terminal time to reset before exiting
    setTimeout(() => {
      process.exit(0);
    }, 50);
  }
}

// Demo: Simulate streaming logs
function startDemo() {
  const viewer = new InteractiveLogViewer();

  const logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const messages = [
    'Application started successfully',
    'Database connection established',
    'User authentication completed',
    'Request processing started',
    'Cache hit for key: user_123',
    'Database query executed in 45ms',
    'API call to external service timeout',
    'Retrying failed operation',
    'Session expired for user',
    'Configuration loaded from file',
    'Memory usage: 256MB',
    'HTTP request received: GET /api/users',
    'Response sent with status 200',
    'Connection pool size: 10/20',
    'Background job started',
    'ERROR: Failed to connect to service',
    'WARNING: High memory usage detected',
    'DEBUG: Entering critical section',
    'Transaction completed successfully',
    'Scheduled task executed',
    'ERROR: Timeout waiting for response',
    'INFO: New user registered',
    'Cache invalidated for key: session_456',
    'File uploaded successfully',
    'Email sent to user@example.com',
    'WARN: Rate limit approaching threshold',
    'Metrics collected and sent',
    'Health check passed',
    'ERROR: Invalid input parameters',
    'Request queued for processing'
  ];

  let counter = 0;

  // Add initial logs quickly
  const initialInterval = setInterval(() => {
    if (counter >= 50) {
      clearInterval(initialInterval);
      // Start faster log streaming
      startContinuousStreaming();
      return;
    }

    const level = logLevels[Math.floor(Math.random() * logLevels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    viewer.addLog({
      timestamp: new Date(),
      level: level,
      message: `[Thread-${Math.floor(Math.random() * 10)}] ${message} (id: ${counter + 1})`
    });

    counter++;
  }, 50);

  function startContinuousStreaming() {
    setInterval(() => {
      if (!viewer.isRunning) {
        return;
      }

      const level = logLevels[Math.floor(Math.random() * logLevels.length)];
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      viewer.addLog({
        timestamp: new Date(),
        level: level,
        message: `[Thread-${Math.floor(Math.random() * 10)}] ${message} (id: ${counter + 1})`
      });

      counter++;
    }, 200);
  }

  // Show welcome message (vi-like, minimal)
  setTimeout(() => {
    viewer.logBox.setContent(
      '\n' +
      '  Interactive Log Viewer - Prototype\n' +
      '  \n' +
      '  Press : to enter command mode\n' +
      '  Try: :?ERROR? to filter errors\n' +
      '  Press q to quit\n' +
      '\n' +
      '~\n'.repeat(10) +
      viewer.logBox.getContent()
    );
    viewer.screen.render();
  }, 500);
}

// Show help if --help is passed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Interactive Log Viewer - Prototype
===================================

Usage: node prototype-interactive-logs.js

This prototype demonstrates an interactive log viewer with vi-style command mode.

Keyboard Shortcuts:
  :               Enter command mode
  q               Quit (in normal mode)
  ↑/↓ or j/k      Scroll up/down
  Page Up/Down    Scroll page up/down
  Home/End or g/G Jump to start/end
  ESC             Exit command mode
  Ctrl+C          Force quit

Commands (after pressing :):
  ?pattern?       Filter logs matching regex pattern
                  Examples: :?ERROR?  :?timeout?  :?user.*failed?
  
  /pattern/       Alternative filter syntax (vi-style)
                  Example: :/ERROR/
  
  pattern         Shorthand filter (no delimiters needed)
                  Example: :ERROR
  
  clear or c      Clear filter, show all logs
  
  q or quit       Quit the viewer

Examples:
  :?ERROR?        Show only logs containing ERROR
  :?ERROR|WARN?   Show logs containing ERROR or WARN
  :?timeout?i     Case-insensitive filter for timeout
  :clear          Remove filter, show all logs
  :q              Quit

The prototype simulates streaming logs with different levels (DEBUG, INFO, WARN, ERROR).
Try filtering them in real-time!
`);
  process.exit(0);
}

// Start the demo
console.log('Starting interactive log viewer prototype...');
console.log('Press Ctrl+C if the viewer does not start properly.');
setTimeout(startDemo, 100);

