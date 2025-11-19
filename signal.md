- async derived

  - upon re-render
    - which suspense to grab
    - how many time _brender()
      - _br to check dep, _br to apply
      - compute sources, _br, [wait], _br
  - when to start a derived?
    - on setup?
    - lazily?
  - auto SuspenseTransition
  - Questions
    1. how to detect async whinin a computation?
      - re-run
      - dependency array, function
      - using await (can a _brender be async?)
      - throw
      - compilation hoisting
    2. with sync and async write:
      2.1 should we show intermediate async if we write on the async before the previous one resolved?
        - See https://svelte.dev/playground/0a3bbcf95eda413a9aeb13aebb493726?version=5.42.1
        - answer:
          - it looks like throttling/debouncing
          - maybe that should be configurable
            - batch/debouncedBatch
            - default behavior is to show intermediate values
          - an any case, the resolution sequence should be ordered by the call order
          - implication:
            - multiples branches available at the same time
        - confidence: moderate
      2.2 should a sync write while there is an pending promise be applied?
        - answer: yes
        - confidence: high
      2.2 should a async sync write while there is an pending promise be applied?
        - answer: ideally yes, tradeoff: no
        - confidence: moderate
        - rational:
          - if we make a different transaction, we should be able to isolate it and update as soon as the transaction finishes. But that might make the implementation and performances more costly.
    3. is async write the same as an async derived
      - example:
        - batchAsync(async ()=> {await p; setA()})
        - derivedAsync(async() => {await p; return a()})
      - answer: it looks like
      - confidence: moderate
    4. with async write, should we eagerly re-fetch promises
      - example:
        - a = signal()
        - b = signal()
        - d = derived(() => await p1; a() + b())
        - batchAsync(async ()=> {setA(); await p; setB()})
      - should we eagerly restart d as soon as we setA or should we wait for the transaction to finish?
      - answer: as we batch, we want to schedule the read until the last instruction, except if we read in the middle.
    5. what happens if we write before the async derived tracked a signal
      - example
        - [a, setA] = signal(1)
        - p = deferred()
        - d = derived(()=> await p; a())
        - e = effect(d)
        - setA(2)
        - p.resolve()
      - solution: that should work
      - sub-question:
        - when accessing a(), should it return the value at the time the transaction started or the current value?
    6. Is a suspense a kind of transaction?
      - Tree of suspense are available through
  - reflections
    - there are changes we want to see despite an promise pending
      - example:
        - d = derivedAsync(...)
        - value: {d()}
    - there are changes we want to hide until a promise resolve
      - example:
        - d = derivedAsync(...)
        - isPending: {d.pending}
    - an easy implementation could be to just add the derived async
      on onWillStart and onWillUpdateProps, the return value is the
      derived state.
  - rules
    - effects run:
      - track values
      - apply values
    - effects should not render until all async are executed
      - no dom patch before all async resolve
    - re-run effects with async

------

What do we need from a reactive system?
  Predictable Execution
    - All updates happen synchronously
    - Glitch-free: Never possible to observe an inconsistent state
    - No computation runs more than once from a given update
    - Prevent infinite loops


view
withSearch

Controller
Layout

------


class A
  _x: signal
  x: compute()
    if (this.x) this.x
    return this.y;


// on record created
// on field change
class Partner {

}

field.onUpdate = () =>


parentFieldName = partner_id
parent
parentFileds: user.name -> user.partner_id.name


- 2 worker write add/delete ?
- clock per field?

- sort in postgres
- different sort in form view
- notes in form vue

- update of field = async

- one2one

- onchange

-
  - state Optimistic
  - state 



# todo
## make doc
### content
#### signals
- useState is useless
``` js

class Parent extends Component {
  setup() {
    const todos = reactive([]);
    useEnv({
      getFirstTodo: () => todos[0],
    });
  }
}

class Child extends Component {
  static template = xml`<t t-out="this.firstTodo"/>`;
  setup() {
    this.firstTodo = useState(this.env.getFirstTodo());
  }
}

class Child extends Component {
  static template = xml`<t t-out="this.env.getFoo()"/>`;
}


function getSomething(key) {
  return registry.category('someReactiveValues').value();
}

class MyComp extends Component {
  static template = xml`
    <t t-out="this.env.getSomething(this.state.value)"/>
  `;
}

```
#### derived
- before: effect to synchronise data
- recompute whenever one of the dependency changes
  - currently needed in pos for the relational model
  - currently needed in mail for the relational model
- future: async derived
  - cancel if recomputed
  - cancel if component destroyed

### todo
- find imperative example that could be derived
- build everything from reactive principle vs build from imperative principle


## derived in odoo
- check in odoo where derived could have been used:
  - useEffect, effect, willUpdateProps, services

## derived
- unsubscribe from derived when there is no need to read from them
- improve test
  - more assertion within one test
  - less test to compress the noise?

## Models
- relations one2many, many2many
  - delete
- automatic models
- partial lists
- draft record
- indexes

## Optimisation
- map/filter/reducte/... with delta data structure

## owl component
- test proper unsubscription





# pos
- great:
  - automatically fetch model definition
  - offline
- missing:
  - choice between online/offline fetching (it only get data offline)
  - multi-level draft


# questions
to batch write in next tick or directly?

# optimization
- fragmented memory
- Entity-Component-System

# future
- worker for computation?
- cap'n web


# encountered issues in odoo
## dropdown issue
- there was a problem that writing in a state while the effect was updated.
  - the tracking of signal being written were dropped because we cleared it
    after re-running the effect that made a write.
  - solution: clear the tracked signal before re-executing the effects
- reading signal A while also writing signal A makes an infinite loop
  - current solution: use toRaw in order to not track the read
  - possible better solution to explore: do not track read if there is a write in a effect.
## website issue
- a rpc request was made on onWillStart, onWillStart was tracking reads. (see WebsiteBuilderClientAction)
  - The read subsequently made a write, that re-triggered the onWillStart.
  - A similar situation happened with onWillUpdateProps (see Transition)
  - solution: prevent tracking reads in onWillStart and onWillUpdateProps
