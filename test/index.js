import treoWebsql from 'treo-websql'
import { expect } from 'chai'
import { pluck, toArray } from 'lodash'
import Schema from '../src'

treoWebsql.polyfill()
const idb = global.indexedDB
const dbName = 'mydb'

describe('idb-schema', function idbSchemaTest() {
  this.timeout(5000)
  let db

  before(clean)
  afterEach(clean)

  function clean(done) {
    if (db) {
      db.close()
      db = null
    }
    // avoid weird issue in Safari and IE
    setTimeout(() => {
      const req = idb.deleteDatabase(dbName)
      req.onerror = done
      req.onblocked = () => clean(done) // transaction was not complete, repeat
      req.onsuccess = () => done()
    }, 100)
  }

  it('describes database', (done) => {
    const schema = new Schema()
    .addStore('modules', { key: 'name' })
    .addIndex('byKeywords', 'keywords', { multiEntry: true })
    .addIndex('byAuthor', 'author', { unique: true })
    .addIndex('byRating', ['stars', 'position'])
    .addIndex('byMaintainers', 'maintainers', { multi: true })
    .addStore('users', { increment: true, keyPath: 'id' })
    .addCallback((e) => {
      const users = e.target.transaction.objectStore('users')
      users.put({ name: 'Fred' })
      users.put({ name: 'John' })
      users.put({ name: 'Barney' })
    })

    expect(schema.callback()).a('function')
    expect(schema.version()).equal(1)
    expect(schema.stores()[0].indexes).length(4)
    expect(schema.stores()[1]).eql({ name: 'users', indexes: [], keyPath: 'id', autoIncrement: true })

    const req = idb.open(dbName, schema.version())
    req.onupgradeneeded = schema.callback()
    req.onerror = done
    req.onsuccess = (e1) => {
      db = e1.target.result
      expect(db.version).equal(1)
      expect(toArray(db.objectStoreNames)).eql(['modules', 'users'])

      const modules = db.transaction(['modules'], 'readonly').objectStore('modules')
      expect(modules.keyPath).equal('name')
      expect(toArray(modules.indexNames).sort()).eql(
        ['byAuthor', 'byKeywords', 'byMaintainers', 'byRating'])

      const users = db.transaction(['users'], 'readonly').objectStore('users')
      expect(users.keyPath).equal('id')

      expect(modules.index('byMaintainers').unique).equal(false)
      expect(modules.index('byAuthor').unique).equal(true)

      // https://msdn.microsoft.com/en-us/library/hh772528(v=vs.85).aspx
      // https://msdn.microsoft.com/en-us/library/hh772573(v=vs.85).aspx
      if (modules.hasOwnProperty('autoIncrement')) {
        expect(users.autoIncrement).equal(true)
        expect(modules.autoIncrement).equal(false)
        expect(modules.index('byMaintainers').multiEntry).equal(true)
        expect(modules.index('byAuthor').multiEntry).equal(false)
      }

      users.count().onsuccess = (e2) => {
        expect(e2.target.result).equal(3)
        done()
      }
    }
  })

  it('enables cascading migrations', (done) => {
    const schema = new Schema()
    .version(1)
      .addStore('books', { keyPath: 'isbn' })
      .addIndex('byTitle', 'title', { unique: true })
      .addIndex('byAuthor', 'author')
    .version(2)
      .getStore('books')
      .addIndex('byYear', 'year')
    .version(3)
      .addStore('magazines')
      .addIndex('byPublisher', 'publisher')
      .addIndex('byFrequency', 'frequency')

    const req1 = idb.open(dbName, schema.version())
    req1.onupgradeneeded = schema.callback()
    req1.onerror = done
    req1.onsuccess = (e1) => {
      db = e1.target.result
      expect(db.version).equal(3)
      expect(toArray(db.objectStoreNames)).eql(['books', 'magazines'])
      db.close()

      schema.version(4)
      .delStore('books')
      .getStore('magazines')
      .delIndex('byPublisher')

      const req2 = idb.open(dbName, schema.version())
      req2.onupgradeneeded = schema.callback()
      req2.onerror = done
      req2.onsuccess = (e2) => {
        db = e2.target.result
        expect(db.version).equal(4)
        expect(toArray(db.objectStoreNames)).eql(['magazines'])

        const magazines = db.transaction(['magazines'], 'readonly').objectStore('magazines')
        expect(toArray(magazines.indexNames)).eql(['byFrequency'])
        done()
      }
    }
  })

  it('#clone', () => {
    const schema1 = new Schema()
    .version(1)
      .addStore('books', { keyPath: 'isbn' })
      .addIndex('byTitle', 'title', { unique: true })
      .addIndex('byAuthor', 'author')
    .version(2)
      .getStore('books')
      .addIndex('byYear', 'year')

    const schema2 = schema1.clone()
    .version(3)
      .addStore('magazines')
      .addIndex('byPublisher', 'publisher')
      .addIndex('byFrequency', 'frequency')

    expect(schema1.version()).equal(2)
    expect(schema2.version()).equal(3)
    expect(pluck(schema1.stores(), 'name')).eql(['books'])
    expect(pluck(schema2.stores(), 'name')).eql(['books', 'magazines'])
  })
})
