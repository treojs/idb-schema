# idb-schema [![Build Status](https://travis-ci.org/treojs/idb-schema.png?branch=master)](https://travis-ci.org/treojs/idb-schema)

DSL to manage IndexedDB schema.

## Installation

```bash
npm install --save idb-schema
```

## Example

```js
var Schema = require('idb-schema');

// define schema
var schema = new Schema()
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
  .dropIndex('byPublisher');

// get schema version
schema.version(); // 4

// generate callback for db.onupgradeneeded event
schema.callback();

// get description of the stores
schema.stores();
// [{ name: 'books', indexes: [{..}, {..}, {..}], keyPath: 'isbn' },
//  { name: 'magazines', indexes: [{..}] }]
```

## API

### schema.callback()
### schema.stores()
### schema.version([number])
### schema.addStore(name, [opts])
### schema.dropStore(name)
### schema.getStore(name)
### schema.addIndex(name, field, [opts])
### schema.dropIndex(name)

## License

MIT
