## Multiple Workspaces

Real desktops let you organize windows across multiple workspaces. In this
step, you will add three workspaces with a 3D cube transition effect when
switching between them.

Here is what you need to do:

- Add a `currentWorkspace` signal (default `1`) and a `setWorkspace(n)`
  method to the `WindowManagerPlugin`
- When opening a window, assign it to the current workspace
- Create a `WorkspaceSwitcher` component for the taskbar, showing three
  buttons (1, 2, 3) with the active one highlighted
- Update the `WindowManager` to render three workspace faces inside a
  rotatable cube container — each face shows only its workspace's windows
- Add CSS for the 3D cube rotation transition

### Hints

Update the plugin:

```js
currentWorkspace = signal(1);

open(title, component, { width, height } = {}) {
    this.windows().push({
        ...
        workspace: this.currentWorkspace(),
    });
}

setWorkspace(n) {
    this.currentWorkspace.set(n);
}
```

The `WorkspaceSwitcher` is a simple component:

```xml
<div class="workspace-switcher">
  <t t-foreach="[1, 2, 3]" t-as="n" t-key="n">
    <button t-att-class="{ active: this.wm.currentWorkspace() === n }"
            t-on-click="() => this.wm.setWorkspace(n)"
            t-out="n"/>
  </t>
</div>
```

The cube effect uses CSS 3D transforms. The `WindowManager` template wraps
workspaces in a cube:

```xml
<div class="workspaces-container">
  <div class="workspaces-cube" t-att-style="this.cubeStyle()">
    <t t-foreach="[1, 2, 3]" t-as="ws" t-key="ws">
      <div class="workspace-face">
        <t t-foreach="this.windowsForWorkspace(ws)" t-as="win" t-key="win.id">
          <Window .../>
        </t>
      </div>
    </t>
  </div>
</div>
```

The cube CSS positions each face with `rotateY` and `translateZ`, and
rotates the whole cube to show the active workspace:

```css
.workspaces-container {
    perspective: 1200px;
    overflow: hidden;
    flex: 1;
    position: relative;
}

.workspaces-cube {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.6s ease-in-out;
}

.workspace-face {
    position: absolute;
    width: 100%;
    height: 100%;
}

.workspace-face:nth-child(1) { transform: rotateY(0deg) translateZ(50vw); }
.workspace-face:nth-child(2) { transform: rotateY(90deg) translateZ(50vw); }
.workspace-face:nth-child(3) { transform: rotateY(180deg) translateZ(50vw); }
```

The cube rotation is controlled by a computed style:

```js
cubeStyle = computed(() => {
    const angle = (this.wm.currentWorkspace() - 1) * -90;
    return `transform: translateZ(-50vw) rotateY(${angle}deg)`;
});
```

## Notes

The 3D cube effect is achieved with pure CSS: `perspective` on the container
creates the 3D space, `transform-style: preserve-3d` on the cube preserves
child transforms, and each face is rotated + translated into position. The
cube itself rotates to show the active face.
