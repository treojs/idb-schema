# idb-schema [![Build Status](https://travis-ci.org/treojs/idb-schema.png?branch=master)](https://travis-ci.org/treojs/idb-schema)

DSL to manage IndexedDB schema.

## Installation

```bash
npm install --save idb-schema
```

## Example

```js
var createSchema = require('idb-schema');

// define schema
var schema = createSchema()
  .version(1)
    .addStore('books', { key: 'isbn' })
    .addIndex('byTitle', 'title', { unique: true })
    .addIndex('byAuthor', 'author')
  .version(2)
    .getStore('books')
    .addIndex('byYear', 'year')
  .version(3)
    .addStore('magazines')
    .addIndex('byPublisher', 'publisher')
    .addIndex('byFrequency', 'frequency');

// get schema version
schema.version(); // 3

// generate callback for onupgradeneeded event
schema.callback();

// get description of the stores
schema.stores();
// [{ name: 'books', indexes: [{..}, {..}, {..}], keyPath: 'isbn' },
//  { name: 'magazines', indexes: [{..}, {..}] }]
```

## License

MIT
