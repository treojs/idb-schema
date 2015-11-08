# idb-schema

[![](https://img.shields.io/npm/v/idb-schema.svg)](https://npmjs.org/package/idb-schema)
[![](https://img.shields.io/travis/treojs/idb-schema.svg)](https://travis-ci.org/treojs/idb-schema)
[![](http://img.shields.io/npm/dm/idb-schema.svg)](https://npmjs.org/package/idb-schema)

> IndexedDB schema manager.

[![](https://saucelabs.com/browser-matrix/idb-schema.svg)](https://saucelabs.com/u/idb-schema)

## Installation

    npm install --save idb-schema

It also works in legacy but you need to require [IndexedDBShim](https://github.com/axemclion/IndexedDBShim).

## Example

```js
import Schema from 'idb-schema'

// define schema
const schema = new Schema()
.version(1)
  .addStore('books', { key: 'isbn' })
  .addIndex('byTitle', 'title', { unique: true })
  .addIndex('byAuthor', 'author')
.version(2)
  .getStore('books')
  .addIndex('byDate', ['year', 'month'])
.version(3)
  .addStore('magazines')
  .addIndex('byPublisher', 'publisher')
  .addIndex('byFrequency', 'frequency')
.version(4)
  .getStore('magazines')
  .delIndex('byPublisher')
  .addCallback((upgradeNeededEvent) => {
    // do something custom
  })

// get schema version
schema.version() // 4

// generate callback for db.onupgradeneeded event
schema.callback()

// get description of stores
schema.stores()
// [{ name: 'books', indexes: [{..}, {..}, {..}], keyPath: 'isbn' },
//  { name: 'magazines', indexes: [{..}] }]
```

## API

### schema.callback()

Generate `onupgradeneeded` callback.

```js
const req = indexedDB.open('mydb', schema.version())
req.onupgradeneeded = schema.callback()
req.onsuccess = (e) => {
  const db = e.target.result
}
```

### schema.stores()

Get JSON representation of database schema.

```json
[
  {
    "name": "books",
    "indexes": [
      {
        "name": "byTitle",
        "field": "title",
        "multiEntry": false,
        "unique": true
      },
      {
        "name": "byAuthor",
        "field": "author",
        "multiEntry": false,
        "unique": false
      },
      {
        "name": "byDate",
        "field": [
          "year",
          "month"
        ],
        "multiEntry": false,
        "unique": false
      }
    ],
    "keyPath": "isbn",
    "autoIncrement": false
  },
  {
    "name": "magazines",
    "indexes": [
      {
        "name": "byFrequency",
        "field": "frequency",
        "multiEntry": false,
        "unique": false
      }
    ],
    "keyPath": null,
    "autoIncrement": false
  }
]
```

### schema.version([number])

Get current version or set new version to `number` and reset current store.
Use it to separate migrations on time.

### schema.addStore(name, [opts])

Create object store with `name`.

Options:
* `key` || `keyPath` - primary key (default: null)
* `increment` || `autoIncrement` - increment key automatically (default: false)

### schema.delStore(name)

Delete store by `name`.

### schema.getStore(name)

Switch current store.
Use it to make operations with indexes.

### schema.addIndex(name, field, [opts])

Create index with `name` and to `field` (or array of fields).

Options:
* `unique` - (default: false)
* `multi` || `multiEntry` - (default: false)

### schema.delIndex(name)

Delete index by `name` from current store.

### schema.addCallback(cb)

Add `cb` to be executed at the end of the `upgradeneeded` event.

```js
new Schema()
.addStore('users', { increment: true, keyPath: 'id' })
.addIndex('byName', 'name')
.addCallback((e) => {
  const users = e.target.transaction.objectStore('users')
  users.put({ name: 'Fred' })
  users.put({ name: 'Barney' })
})
```

### schema.clone()

Return a deep clone of current schema.

## License

[MIT](./LICENSE)
