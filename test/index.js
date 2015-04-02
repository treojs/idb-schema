var expect = require('chai').expect;
var Schema = require('../lib');
var idb = global.indexedDB;

// enable WebSQL polyfill
if (!idb) {
  require('./support/indexeddb-shim');
  idb = global.indexedDB;
}

describe('idb-schema', function() {
  var dbName = 'mydb2';
  var db;

  function clean(done) {
    if (db) {
      db.close();
      db = null;
    }
    var req = idb.deleteDatabase(dbName);
    req.onerror = req.onblocked = done;
    req.onsuccess = function onsuccess() { done() };
  }

  before(clean);
  afterEach(clean);

  it('describes database', function(done) {
    var schema = new Schema()
      .addStore('modules', { key: 'name' })
      .addIndex('byKeywords', 'keywords', { multiEntry: true })
      .addIndex('byAuthor', 'author', { unique: true })
      .addIndex('byStars', 'stars')
      .addIndex('byMaintainers', 'maintainers', { multi: true })
      .addStore('users', { increment: true });

    expect(schema.callback()).a('function');
    expect(schema.version()).equal(1);
    expect(schema.stores()[0].indexes).length(4);
    expect(schema.stores()[1]).eql({ name: 'users', indexes: [], keyPath: null, autoIncrement: true });

    var req = idb.open(dbName, schema.version());
    req.onupgradeneeded = schema.callback();
    req.onerror = req.onblocked = done;
    req.onsuccess = function onsuccess(e) {
      db = e.target.result;
      expect(db.version).equal(1);
      expect([].slice.call(db.objectStoreNames)).eql(['modules', 'users']);

      var modules = db.transaction(['modules'], 'readonly').objectStore('modules');
      expect(modules.keyPath).equal('name');
      expect(modules.autoIncrement).false;
      expect([].slice.call(modules.indexNames).sort()).eql(
        ['byAuthor', 'byKeywords', 'byMaintainers', 'byStars']);

      var users = db.transaction(['users'], 'readonly').objectStore('users');
      expect(users.keyPath).null;
      expect(users.autoIncrement).true;

      expect(modules.index('byMaintainers').unique).false;
      expect(modules.index('byMaintainers').multiEntry).true;
      expect(modules.index('byAuthor').unique).true;
      expect(modules.index('byAuthor').multiEntry).false;
      done();
    };
  });

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
      .addIndex('byFrequency', 'frequency');

    var req = idb.open(dbName, schema.version());
    req.onupgradeneeded = schema.callback();
    req.onerror = req.onblocked = done;
    req.onsuccess = function onsuccess(e) {
      db = e.target.result;
      expect(db.version).equal(3);
      expect([].slice.call(db.objectStoreNames)).eql(['books', 'magazines']);
      db.close();

      schema = schema.version(4)
        .dropStore('books')
        .getStore('magazines')
        .dropIndex('byPublisher');

      req = idb.open(dbName, schema.version());
      req.onupgradeneeded = schema.callback();
      req.onerror = req.onblocked = done;
      req.onsuccess = function onsuccess(e) {
        db = e.target.result;
        expect(db.version).equal(4);
        expect([].slice.call(db.objectStoreNames)).eql(['magazines']);

        var magazines = db.transaction(['magazines'], 'readonly').objectStore('magazines');
        expect([].slice.call(magazines.indexNames)).eql(['byFrequency']);
        done();
      };
    };
  });
});
