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

# future
- worker for computation?
- cap'n web
