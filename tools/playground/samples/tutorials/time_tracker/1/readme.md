# Time Tracker Tutorial - Step 1: Static Display

## Goal

Mount a component that renders a hardcoded timer value.

## Instructions

1. Create a `TimeTracker` component
2. Define a template with a timer display showing "25:00"
3. Mount the component to the document body

## Key Concepts

- **Component**: The base class for all Owl components
- **static template**: Associates an XML template with the component
- **mount()**: Renders the component into the DOM

## Code

```javascript
import { Component, mount, xml } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">25:00</div>
    </div>
  `;
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

## Explanation

- `xml` tag creates an inline template (alternative to separate XML files)
- `TEMPLATES` is a global provided by the playground containing all XML templates
- The component renders immediately when mounted

## Try It

1. Click "Run" to see the timer display
2. Change "25:00" to a different time in the template
3. Add more elements to the template

## Next Step

In step 2, we'll make the timer dynamic with reactive state.
