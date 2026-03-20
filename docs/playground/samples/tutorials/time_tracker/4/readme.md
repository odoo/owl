# Time Tracker Tutorial - Step 4: Reset Functionality

## Goal

Add a reset button to restore the timer to its initial duration.

## Instructions

1. Add a `duration` signal to store the initial duration (25 minutes)
2. Create a `reset` method that stops the timer and resets remaining time
3. Add a Reset button next to Start/Pause

## Key Concepts

- **Multiple signals**: Separating configuration from current state
- **State coordination**: Updating multiple pieces of state together
- **Cleanup pattern**: Stopping side effects before resetting

## Code Highlights

```javascript
duration = signal(25 * 60);  // Initial duration
remainingSeconds = signal(25 * 60);  // Current remaining time

reset() {
  if (this.intervalId) {
    clearInterval(this.intervalId);
    this.intervalId = null;
  }
  this.isRunning.set(false);
  this.remainingSeconds.set(this.duration());  // Reset to initial duration
}
```

## Template

```xml
<div class="controls">
  <button t-on-click="this.toggleTimer">
    <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
  </button>
  <button t-on-click="this.reset">Reset</button>
</div>
```

## Try It

1. Start the timer and let it run for a few seconds
2. Click Reset - timer stops and returns to 25:00
3. Start again to begin fresh

## Next Step

In step 5, we'll add work/break phases.
