require('treo-websql').polyfill()
var expect = require('chai').expect
var pluck = require('lodash.pluck')
var toArray = require('lodash.toarray')
var Schema = require('../lib')

describe('idb-schema', function() {
  var idb = global.indexedDB
  var dbName = 'mydb'
  var db

  afterEach(function clean(done) {
    if (db) {
      db.close()
      db = null
    }
    var req = idb.deleteDatabase(dbName)
    req.onblocked = function onblocked() { clean(done) } // transaction was not complete, repeat
    req.onsuccess = function onsuccess() { done() }
  })

  it('describes database', function(done) {
    var schema = new Schema()
    .addStore('modules', { key: 'name' })
    .addIndex('byKeywords', 'keywords', { multiEntry: true })
    .addIndex('byAuthor', 'author', { unique: true })
    .addIndex('byRating', ['stars', 'position'])
    .addIndex('byMaintainers', 'maintainers', { multi: true })
    .addStore('users', { increment: true })
    .addCallback(function(e) {
      var users = e.target.transaction.objectStore('users')
      users.put({ name: 'Fred' })
      users.put({ name: 'Fred' })
      users.put({ name: 'Barney' })
    })

    expect(schema.callback()).a('function')
    expect(schema.version()).equal(1)
    expect(schema.stores()[0].indexes).length(4)
    expect(schema.stores()[1]).eql({ name: 'users', indexes: [], keyPath: null, autoIncrement: true })

    var req = idb.open(dbName, schema.version())
    req.onupgradeneeded = schema.callback()
    req.onerror = req.onblocked = done
    req.onsuccess = function(e1) {
      db = e1.target.result
      expect(db.version).equal(1)
      expect(toArray(db.objectStoreNames)).eql(['modules', 'users'])

      var modules = db.transaction(['modules'], 'readonly').objectStore('modules')
      expect(modules.keyPath).equal('name')
      expect(modules.autoIncrement).equal(false)
      expect(toArray(modules.indexNames).sort()).eql(
        ['byAuthor', 'byKeywords', 'byMaintainers', 'byRating'])

      var users = db.transaction(['users'], 'readonly').objectStore('users')
      expect(users.keyPath).equal(null)
      expect(users.autoIncrement).equal(true)

      expect(modules.index('byMaintainers').unique).equal(false)
      expect(modules.index('byMaintainers').multiEntry).equal(true)
      expect(modules.index('byAuthor').unique).equal(true)
      expect(modules.index('byAuthor').multiEntry).equal(false)

      users.count().onsuccess = function(e2) {
        expect(e2.target.result).equal(3)
        done()
      }
    }
  })

  it('enables cascading migrations', function(done) {
    var schema = new Schema()
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

    var req = idb.open(dbName, schema.version())
    req.onupgradeneeded = schema.callback()
    req.onerror = req.onblocked = done
    req.onsuccess = function(e1) {
      db = e1.target.result
      expect(db.version).equal(3)
      expect(toArray(db.objectStoreNames)).eql(['books', 'magazines'])
      db.close()

      schema = schema.version(4)
      .delStore('books')
      .getStore('magazines')
      .delIndex('byPublisher')

      req = idb.open(dbName, schema.version())
      req.onupgradeneeded = schema.callback()
      req.onerror = req.onblocked = done
      req.onsuccess = function(e2) {
        db = e2.target.result
        expect(db.version).equal(4)
        expect(toArray(db.objectStoreNames)).eql(['magazines'])

        var magazines = db.transaction(['magazines'], 'readonly').objectStore('magazines')
        expect(toArray(magazines.indexNames)).eql(['byFrequency'])
        done()
      }
    }
  })

  it('#clone', function() {
    var schema1 = new Schema()
    .version(1)
      .addStore('books', { keyPath: 'isbn' })
      .addIndex('byTitle', 'title', { unique: true })
      .addIndex('byAuthor', 'author')
    .version(2)
      .getStore('books')
      .addIndex('byYear', 'year')

    var schema2 = schema1.clone()
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
