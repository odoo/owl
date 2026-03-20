# Time Tracker Tutorial - Step 5: Work/Break Phases

## Goal

Switch between work (25 min) and break (5 min) phases automatically.

## Instructions

1. Add an `isWorkPhase` signal to track current phase
2. Create constants for work and break durations
3. Automatically switch phases when timer reaches zero
4. Add visual indication of current phase (different colors/styles)
5. Add a Skip button to manually switch phases

## Key Concepts

- **State machine pattern**: Managing transitions between discrete states
- **t-att-class**: Dynamic CSS classes based on state
- **Conditional rendering**: Showing different content based on state
- **Automatic transitions**: Triggering state changes programmatically

## Code Highlights

```javascript
const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

isWorkPhase = signal(true);

get duration() {
  return this.isWorkPhase() ? WORK_DURATION : BREAK_DURATION;
}

phaseClass = computed(() =>
  this.isWorkPhase() ? "work-phase" : "break-phase"
);

completePhase() {
  this.isWorkPhase.set(!this.isWorkPhase());
  this.remainingSeconds.set(this.duration);
}
```

## Template

```xml
<div class="time-tracker" t-att-class="this.phaseClass()">
  <div class="phase-label">
    <t t-out="this.isWorkPhase() ? 'Work Session' : 'Break Time'"/>
  </div>
  <!-- ... timer display and controls ... -->
  <button t-on-click="this.skipPhase">Skip</button>
</div>
```

## Try It

1. Start the timer and wait for it to complete (or skip)
2. Notice the phase switches from Work to Break
3. The timer resets to 5:00 for break time
4. The visual style changes based on phase

## Next Step

In step 6, we'll add a progress bar.
