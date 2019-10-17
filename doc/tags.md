# 🦉 Tags 🦉

Tags are very small helpers to make it easy to write inline templates. There is
only one currently available tag: `xml`, but we plan to add other tags later,
such as a `css` tag, which will be used to write single file components.

## XML tag

Without tags, creating a standalone component would look like this:

```js
import { Component } from 'owl'

const name = 'some-unique-name';
const template = `
    <div>
        <span t-if="somecondition">text</span>
        <button t-on-click="someMethod">Click</button>
    </div>
`;
QWeb.registerTemplate(name, template);

class MyComponent extends Component {
    static template = name;

    ...
}
```

With tags, this process is slightly simplified. The name is uniquely generated,
and the template is automatically registered:

```js
import { Component } from 'owl'
import { xml } from 'owl/tags'

class MyComponent extends Component {
    static template = xml`
        <div>
            <span t-if="somecondition">text</span>
            <button t-on-click="someMethod">Click</button>
        </div>
    `;

    ...
}
```
