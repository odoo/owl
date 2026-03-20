# Time Tracker Tutorial - Step 7: Session History

## Goal

Track completed work sessions in a history log.

## Instructions

1. Add a `sessions` signal.Array to store completed sessions
2. Add a `completePhase()` method that records completed work sessions
3. Use `t-foreach` to display the session list
4. Only record completed work sessions (not breaks)

## Key Concepts

- **signal.Array**: A reactive array with push/filter methods
- **t-foreach**: List rendering directive
- **t-key**: Unique key for each list item
- **Conditional recording**: Only show history when there are sessions

## Code Highlights

```javascript
sessions = signal.Array([]);
sessionId = 0;

completePhase() {
  if (this.isWorkPhase()) {
    this.sessions.push({
      id: this.sessionId++,
      completedAt: new Date().toLocaleTimeString(),
    });
  }
  this.switchPhase();
}
```

## Template

```xml
<div class="sessions" t-if="this.sessions().length">
  <h3>Completed Sessions</h3>
  <ul>
    <t t-foreach="this.sessions()" t-as="session" t-key="session.id">
      <li>
        <t t-out="session.completedAt"/>
      </li>
    </t>
  </ul>
</div>
```

## signal.Array

`signal.Array([])` creates a reactive array with special methods:

- `push(item)` - adds an item
- `pop()` - removes last item
- `filter(fn)` - filters items
- Regular array methods work too (map, forEach, etc.)

## Try It

1. Complete a full work session (let timer reach 00:00)
2. Watch a session appear in the history
3. Complete another work session
4. Break sessions are not recorded

## Congratulations!

You've completed the Time Tracker tutorial! You've learned:

- Components and templates
- Signals and computed values
- Event handling
- Lifecycle hooks
- State management
- Dynamic styling
- Progress indicators
- List rendering
