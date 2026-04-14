# Time Tracker Tutorial - Step 6: Progress Bar

## Goal

Add a visual progress indicator showing how much time has elapsed.

## Instructions

1. Add a `progress` computed that calculates percentage complete (2-100%)
2. Add a `progressStyle` computed that returns the CSS width
3. Add a progress bar element with progress fill to the template
4. Style the progress bar differently for work/break phases

## Key Concepts

- **computed() for visual properties**: Deriving CSS values from state
- **t-att-style**: Dynamic inline styles
- **Connecting reactivity to UI**: Visual feedback from state changes

## Code Highlights

```javascript
progress = computed(() => {
  const total = this.duration;
  const remaining = this.remainingSeconds();
  return ((total - remaining) / total) * 100;
});

progressStyle = computed(() => `width: ${this.progress()}%`);
```

## Template

```xml
<div class="progress-bar">
  <div class="progress-fill" t-att-style="this.progressStyle()"/>
</div>
```

## CSS

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 1s linear;
}

.work-phase .progress-fill {
  background: #f44336;
}

.break-phase .progress-fill {
  background: #4caf50;
}
```

## Try It

1. Start the timer and watch the progress bar fill
2. Notice different colors for work (red) vs break (green)
3. Progress smoothly animates as time passes

## Next Step

In step 7, we'll add session history tracking.
