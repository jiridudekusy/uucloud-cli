# 🚀 Interactive Logs Prototype - Quick Start

## ✅ Ready to Test!

The prototype is ready to run. Here's how to get started:

### Run the Prototype

```bash
# Option 1: Direct execution
node prototype-interactive-logs.js

# Option 2: Make it executable and run
chmod +x prototype-interactive-logs.js
./prototype-interactive-logs.js

# Show help
node prototype-interactive-logs.js --help
```

### What to Expect

When you run the prototype, you'll see:

1. **A terminal UI** with:
   - Scrollable log area at the top
   - Status bar showing mode and stats
   - Command line at the bottom

2. **Simulated streaming logs** with different levels:
   - 🔴 ERROR - Red, bold
   - 🟡 WARN - Yellow, bold
   - 🔵 INFO - Cyan, bold
   - ⚪ DEBUG - Gray, bold

3. **Initial burst**: 50 logs load quickly
4. **Continuous stream**: New log every second

## 🎯 Try These Commands

### Basic Filtering

```
# Press : then type:
?ERROR?              # Show only ERROR logs
?WARN?               # Show only WARN logs
?ERROR|WARN?         # Show ERROR or WARN logs
```

### Advanced Regex

```
?Thread-[0-5]?       # Threads 0-5 only
?timeout?            # Any log with "timeout"
?user.*failed?       # "user" followed by "failed"
```

### Clear and Quit

```
clear                # or just 'c' - remove filter
quit                 # or just 'q' - exit
```

### Navigation

- Use **arrow keys** or **j/k** to scroll
- **Page Up/Down** for page scrolling
- **Home/End** or **g/G** to jump to start/end
- **ESC** to exit command mode

## 🎨 Visual Guide

```
┌──────────────────────────────────────────────────────┐
│ 2024-10-02T... INFO  [Thread-3] Application started │ ← Scrollable
│ 2024-10-02T... ERROR [Thread-1] Connection failed   │   log area
│ 2024-10-02T... WARN  [Thread-5] High memory usage   │
│ ...                                                  │
├──────────────────────────────────────────────────────┤
│ Mode: NORMAL | Filter: ERROR | Showing: 15 / 234    │ ← Status bar
├──────────────────────────────────────────────────────┤
│ :?ERROR?                                             │ ← Command line
└──────────────────────────────────────────────────────┘
```

## 📝 Test Checklist

Try these scenarios:

- [ ] Run the prototype and see logs appearing
- [ ] Press `:` and enter command mode
- [ ] Filter for `?ERROR?` and see only errors
- [ ] Press `:clear` to show all logs again
- [ ] Try a complex regex: `?Thread-[0-5].*timeout?`
- [ ] Use arrow keys to scroll up/down
- [ ] Press `g` to jump to top, `G` to jump to bottom
- [ ] Watch how new logs appear when filtered
- [ ] Try the alternative syntax: `:/ERROR/`
- [ ] Press `q` to quit cleanly

## 🐛 Troubleshooting

### Terminal doesn't look right?
- Make sure your terminal is at least 80x24 characters
- Use a modern terminal emulator (iTerm2, Terminal.app, etc.)

### Can't see colors?
- Check that your terminal supports colors
- Try running: `echo $TERM` (should show something like `xterm-256color`)

### Logs not appearing?
- Wait a few seconds - initial logs load quickly
- Check console output for any errors

### Want to force quit?
- Press **Ctrl+C** at any time

## 📊 What's Being Demonstrated

✅ **Vi-style command mode** - Press `:` to enter commands  
✅ **Regex filtering** - Use `?pattern?` syntax for filtering  
✅ **Real-time updates** - Filters apply to new logs instantly  
✅ **Keyboard navigation** - Scroll, jump, and navigate like vi  
✅ **Visual feedback** - Status bar shows current state  
✅ **Color coding** - Log levels have distinct colors  
✅ **Pattern highlighting** - Matched text is highlighted  

## 💡 Implementation Notes

This prototype demonstrates the **core concept** with:
- ~500 lines of code
- Zero modifications to existing codebase
- Using only existing dependencies (`blessed`, `chalk`)
- Simulated streaming logs for testing

### Key Features Working

1. ✅ Interactive terminal UI
2. ✅ Vi-style command mode (`:` prefix)
3. ✅ Regex filtering (`?pattern?` syntax)
4. ✅ Real-time filter application
5. ✅ Keyboard shortcuts
6. ✅ Auto-scrolling
7. ✅ Pattern highlighting
8. ✅ Mode switching

### Not Yet Implemented

- ⏳ Integration with actual `uucloud logs` command
- ⏳ Saving filtered logs to file
- ⏳ Multiple filter combination (AND/OR)
- ⏳ Search history
- ⏳ Copy to clipboard
- ⏳ Pause/resume streaming

## 🎉 Next Steps

After testing the prototype:

1. **Provide feedback** on the UX and commands
2. **Suggest improvements** or additional features
3. **Decide on integration** approach with LogsCommand
4. **Plan the full implementation** if approved

---

**Questions? Issues?**

- Check `PROTOTYPE-README.md` for more details
- The code is well-commented for easy understanding
- Feel free to modify and experiment!

**Have fun testing!** 🚀

