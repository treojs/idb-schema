import 'indexeddbshim'
import ES6Promise from 'es6-promise'
import { expect } from 'chai'
import { pluck, toArray } from 'lodash'
import { del, open } from 'idb-factory'
import { request } from 'idb-request'
import Schema from '../src'

describe('idb-schema', function idbSchemaTest() {
  this.timeout(5000)
  ES6Promise.polyfill()
  const dbName = 'mydb'
  let db

  before(() => del(dbName))
  afterEach(() => del(db || dbName))

  it('describes database', () => {
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

    return open(dbName, schema.version(), schema.callback()).then((originDb) => {
      db = originDb
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

      return request(users.count()).then((count) => {
        expect(count).equal(3)
      })
    })
  })

  it('enables cascading migrations', () => {
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

    return open(dbName, schema.version(), schema.callback()).then((originDb) => {
      db = originDb
      expect(db.version).equal(3)
      expect(toArray(db.objectStoreNames)).eql(['books', 'magazines'])

      db.close()
      schema.version(4)
      .delStore('books')
      .getStore('magazines')
      .delIndex('byPublisher')

      return open(dbName, schema.version(), schema.callback()).then((originDb2) => {
        db = originDb2
        expect(db.version).equal(4)
        expect(toArray(db.objectStoreNames)).eql(['magazines'])

        const magazines = db.transaction(['magazines'], 'readonly').objectStore('magazines')
        expect(toArray(magazines.indexNames)).eql(['byFrequency'])
      })
    })
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

  it('validates arguments', () => {
    const schema = new Schema()
    .version(1)
      .addStore('books', { keyPath: 'isbn' })
      .addIndex('byTitle', 'title', { unique: true })
      .addIndex('byAuthor', 'author')
    .version(2)
      .getStore('books')
      .addIndex('byYear', 'year')

    // version
    expect(() => new Schema().version(0)).throws('invalid version')
    expect(() => new Schema().version(-1)).throws('invalid version')
    expect(() => new Schema().version(2.5)).throws('invalid version')
    expect(() => new Schema().version(Math.pow(2, 32))).throws('invalid version')

    // addStore
    expect(() => new Schema().addStore()).throws('"name" is required')
    expect(() => new Schema().addStore(101)).throws('"name" is required')
    expect(() => new Schema().addStore(101)).throws('"name" is required')
    expect(() => schema.addStore('books')).throws('"books" store is already defined')
    expect(() => new Schema().addStore('books', { autoIncrement: true })).throws('set keyPath in order to use autoIncrement')

    // delStore
    expect(() => new Schema().delStore()).throws('"name" is required')
    expect(() => new Schema().delStore('books')).throws('"books" store is not defined')

    // getStore
    expect(() => new Schema().getStore()).throws('"name" is required')
    expect(() => new Schema().getStore('books')).throws('"books" store is not defined')

    // addIndex
    expect(() => new Schema().addStore('books').addIndex(null, 'title')).throws('"name" is required')
    expect(() => new Schema().addStore('books').addIndex('byTitle')).throws('"field" is required')
    expect(() => new Schema().addIndex('byTitle', 'title')).throws('set current store using "getStore" or "addStore"')
    expect(() => schema.addIndex('byTitle', 'title')).throws('"byTitle" index is already defined')

    // delIndex
    expect(() => schema.delIndex('')).throws('"name" is required')
    expect(() => schema.delIndex('byField')).throws('"byField" index is not defined')
  })
})
