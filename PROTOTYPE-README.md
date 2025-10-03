# Interactive Log Viewer Prototype

This is a standalone prototype demonstrating the interactive log viewer with vi-style command mode for the `uucloud logs` command.

## Quick Start

```bash
# Run the prototype
node prototype-interactive-logs.js

# Show help
node prototype-interactive-logs.js --help
```

## Features Demonstrated

### ✨ Interactive UI
- **Scrollable log view** with colored output
- **Status bar** showing current mode, filter, and log count
- **Command line** for entering commands (vi-style)
- **Auto-scrolling** that follows new logs

### ⌨️ Keyboard Shortcuts

#### Normal Mode
| Key | Action |
|-----|--------|
| `:` | Enter command mode |
| `/` | Quick filter mode |
| `q` | Quit |
| `↑/↓` or `j/k` | Scroll up/down |
| `Page Up/Down` | Scroll by page |
| `Home/End` or `g/G` | Jump to start/end |
| `Ctrl+C` | Force quit |

#### Command Mode
| Command | Description |
|---------|-------------|
| `:?pattern?` | Filter logs matching regex pattern |
| `:/pattern/` | Alternative filter syntax (vi-style) |
| `:pattern` | Shorthand (no delimiters) |
| `:clear` or `:c` | Clear filter, show all logs |
| `:q` or `:quit` | Quit viewer |
| `ESC` | Exit command mode |

## Usage Examples

### Filtering Logs

```
:?ERROR?              # Show only logs containing ERROR
:?ERROR|WARN?         # Show ERROR or WARN logs
:?timeout?            # Filter for timeout issues
:?user.*failed?       # Regex: user followed by failed
:clear                # Remove filter, show all logs
```

### Alternative Syntax

```
:/ERROR/              # Vi-style filter
:ERROR                # Shorthand (treated as regex)
```

## How It Works

1. **Demo Mode**: The prototype simulates streaming logs with random levels (DEBUG, INFO, WARN, ERROR)
2. **Initial Burst**: Loads 50 logs quickly to demonstrate scrolling
3. **Continuous Stream**: Adds new logs every second
4. **Real-time Filtering**: Filters apply immediately to both existing and new logs
5. **Highlight Matches**: Filtered patterns are highlighted in yellow

## Technical Details

### Components
- **InteractiveLogViewer**: Main class managing the UI and state
- **Blessed**: Terminal UI library for creating the interface
- **Regex Filtering**: Uses JavaScript RegExp for pattern matching
- **Event-driven**: Keyboard events trigger mode changes and commands

### Architecture
```
┌─────────────────────────────────────┐
│     Log Display Area (Scrollable)   │
│  ┌─────────────────────────────┐   │
│  │ Logs shown here...          │   │
│  │ With colors and formatting  │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│ Status: NORMAL | Filter: ERROR | 23 │
├─────────────────────────────────────┤
│ :?ERROR?                            │ ← Command line
└─────────────────────────────────────┘
```

## Testing the Prototype

### Test Scenarios

1. **Basic Filtering**
   ```
   - Start prototype
   - Press :
   - Type ?ERROR?
   - Press Enter
   - Observe only ERROR logs shown
   ```

2. **Multiple Filters**
   ```
   - Filter for ERROR
   - Press : again
   - Type ?WARN?
   - See only WARN logs
   - Press :c to clear
   ```

3. **Regex Patterns**
   ```
   - Try: :?Thread-[0-5]?
   - Try: :?started|completed?
   - Try: :?^ERROR.*timeout?
   ```

4. **Navigation**
   ```
   - Use arrow keys to scroll
   - Press g to jump to top
   - Press G to jump to bottom
   - Watch auto-scroll behavior
   ```

## Differences from Final Implementation

This prototype is simplified for demonstration. The final integration will:

- ✅ Use real log data from uuCloud
- ✅ Support all existing log formats (json, jsonstream, gantt)
- ✅ Preserve existing color schemes from LogsCommand
- ✅ Work with multiple apps simultaneously
- ✅ Support all existing filter options (--filter, --criteria)
- ✅ Handle high-volume log streams efficiently
- ✅ Add more commands (save to file, copy, etc.)

## Known Limitations

- **Prototype only**: Not integrated with actual LogsCommand
- **Simulated logs**: Uses random demo data
- **Basic features**: Missing some advanced capabilities
- **No persistence**: Logs are lost when you quit

## Next Steps

If this prototype meets your expectations, the next phase would be:

1. Create `src/misc/interactive-log-viewer.js` based on this prototype
2. Modify `src/commands/LogsCommand.js` to add `--interactive` flag
3. Integrate the viewer with the actual log streaming logic
4. Add tests for the new functionality
5. Update documentation

## Feedback Welcome

Try out the prototype and let me know:
- Is the command syntax intuitive?
- Are there any keyboard shortcuts you'd like to add?
- Should we support other filtering modes?
- Any UI improvements?

---

**Created**: 2024-10-02  
**Purpose**: Proof of concept for interactive log filtering  
**Status**: Prototype - Not for production use

