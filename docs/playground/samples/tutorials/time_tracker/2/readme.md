# Time Tracker Tutorial - Step 2: Reactive State

## Goal

Replace the hardcoded value with a signal and computed formatting.

## Instructions

1. Create a `remainingSeconds` signal initialized to 25 minutes (1500 seconds)
2. Create a `formattedTime` computed that formats the seconds as MM:SS
3. Display the formatted time in the template

## Key Concepts

- **signal()**: Creates a reactive value that triggers re-renders when changed
- **computed()**: Creates a derived value that updates when its dependencies change
- **t-out**: Outputs a value into the DOM

## Code

```javascript
import { Component, mount, xml, signal, computed } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
    </div>
  `;

  remainingSeconds = signal(25 * 60); // 25 minutes in seconds

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

## Explanation

### Signal

```javascript
remainingSeconds = signal(25 * 60);
```

A signal holds a value that can change over time. When the value changes, any component using it re-renders.

### Computed

```javascript
formattedTime = computed(() => {
  const total = this.remainingSeconds(); // Read the signal
  // ... formatting logic
});
```

A computed automatically recalculates when its dependencies (other signals) change.

### Template

```xml
<t t-out="this.formattedTime()"/>
```

`t-out` renders the result of calling `formattedTime()`. Note the parentheses - computed values are functions.

## Try It

1. Change `remainingSeconds` to a different value (e.g., `5 * 60` for 5 minutes)
2. The display updates automatically
3. Try setting it to values like `90` or `3661` to see the formatting

## Next Step

In step 3, we'll add start/pause controls.
