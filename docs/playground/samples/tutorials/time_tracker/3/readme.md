# Time Tracker Tutorial - Step 3: Start/Pause Controls

## Goal

Add a button that starts/pauses the timer with proper lifecycle cleanup.

## Instructions

1. Add an `isRunning` signal to track timer state
2. Add a `toggleTimer` method that starts/stops an interval
3. Use `onWillUnmount` to clean up the interval when component is destroyed
4. Add a button with conditional text (Start/Pause)

## Key Concepts

- **t-on-click**: Event handler binding
- **Conditional rendering**: Show different content based on state
- **onWillUnmount**: Lifecycle hook for cleanup
- **setInterval/clearInterval**: JavaScript timer management

## Code Highlights

```javascript
toggleTimer() {
  if (this.isRunning()) {
    clearInterval(this.intervalId);
    this.intervalId = null;
  } else {
    this.intervalId = setInterval(() => {
      if (this.remainingSeconds() > 0) {
        this.remainingSeconds.set(this.remainingSeconds() - 1);
      }
    }, 1000);
  }
  this.isRunning.set(!this.isRunning());
}

setup() {
  onWillUnmount(() => {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  });
}
```

## Template Highlights

```xml
<button t-on-click="this.toggleTimer">
  <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
</button>
```

## Important: Cleanup

Always clean up intervals in `onWillUnmount`! Without this:

- The interval continues running after component is removed
- Memory leaks and unexpected behavior occur
- Multiple intervals can stack up

## Try It

1. Click "Start" to begin the countdown
2. Click "Pause" to stop it
3. Watch the timer decrease each second
4. Timer stops automatically at 00:00

## Next Step

In step 4, we'll add a reset button.
