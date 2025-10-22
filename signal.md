
- 2 worker write add/delete ?
- clock per field?

- sort in postgres
- different sort in form view
- notes in form vue

- update of field = async



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
