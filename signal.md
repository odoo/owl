# encountered issues
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


# todo
## Models
- relations one2many, many2many
  - delete
- automatic models

## Optimisation
- map/filter/reducte/... with delta data structure


# questions
to batch write in next tick or directly?

# owl component
## todo
- test proper unsubscription

# derived
## todo
- unsubscribe from derived when there is no need to read from them
- improve test
  - more assertion within one test
  - less test to compress the noise?

# optimization
- fragmented memory
- Entity-Component-System

# future
- worker for computation?
- cap'n web



# pos
- createRelatedModels
- pos_available_models").getAll
