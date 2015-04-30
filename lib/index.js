var type = require('component-type');
var clone = require('component-clone');
var values = require('object-values');
var MAX_VERSION = Math.pow(2, 32) - 1;

/**
 * Expose `Schema`.
 */

module.exports = Schema;

/**
 * Initialize new `Schema`.
 */

function Schema() {
  if (!(this instanceof Schema)) return new Schema();
  this._stores = {};
  this._current = {};
  this._versions = {};
  this.version(1);
}

/**
 * Get/Set new version.
 *
 * @param {Number} [version]
 * @return {Schema|Number}
 */

Schema.prototype.version = function(version) {
  if (!arguments.length) return this._current.version;
  if (type(version) != 'number' || version < 1 || version < this.version())
    throw new TypeError('not valid version');

  this._current = { version: version, store: null };
  this._versions[version] = {
    stores: [],      // db.createObjectStore
    dropStores: [],  // db.deleteObjectStore
    indexes: [],     // store.createIndex
    dropIndexes: [], // store.deleteIndex
    version: version // version
  };

  return this;
};

/**
 * Add store.
 *
 * @param {String} name
 * @param {Object} [opts] { key: null, increment: false }
 * @return {Schema}
 */

Schema.prototype.addStore = function(name, opts) {
  if (type(name) != 'string') throw new TypeError('`name` is required');
  if (this._stores[name]) throw new TypeError('store is already defined');
  if (!opts) opts = {};

  var store = {
    name: name,
    indexes: {},
    keyPath: opts.key || opts.keyPath || null,
    autoIncrement: opts.increment || opts.autoIncrement || false
  };
  this._stores[name] = store;
  this._versions[this.version()].stores.push(store);
  this._current.store = store;

  return this;
};

/**
 * Drop store.
 *
 * @param {String} name
 * @return {Schema}
 */

Schema.prototype.delStore =
Schema.prototype.dropStore = function(name) {
  if (type(name) != 'string') throw new TypeError('`name` is required');
  var store = this._stores[name];
  if (!store) throw new TypeError('store is not defined');
  delete this._stores[name];
  this._versions[this.version()].dropStores.push(store);
  this._current.store = null;
  return this;
};

/**
 * Change current store.
 *
 * @param {String} name
 * @return {Schema}
 */

Schema.prototype.getStore = function(name) {
  if (type(name) != 'string') throw new TypeError('`name` is required');
  if (!this._stores[name]) throw new TypeError('store is not defined');
  this._current.store = this._stores[name];
  return this;
};

/**
 * Add index.
 *
 * @param {String} name
 * @param {String|Array} field
 * @param {Object} [opts] { unique: false, multi: false }
 * @return {Schema}
 */

Schema.prototype.addIndex = function(name, field, opts) {
  if (type(name) != 'string') throw new TypeError('`name` is required');
  if (type(field) != 'string' && type(field) != 'array') throw new TypeError('`field` is required');
  if (!opts) opts = {};
  var store = this._current.store;
  if (store.indexes[name]) throw new TypeError('index is already defined');

  var index = {
    name: name,
    field: field,
    storeName: store.name,
    multiEntry: opts.multi || opts.multiEntry || false,
    unique: opts.unique || false
  };
  store.indexes[name] = index;
  this._versions[this.version()].indexes.push(index);

  return this;
};

/**
 * Drop index.
 *
 * @param {String} name
 * @return {Schema}
 */

Schema.prototype.delIndex =
Schema.prototype.dropIndex = function(name) {
  if (type(name) != 'string') throw new TypeError('`name` is required');
  var index = this._current.store.indexes[name];
  if (!index) throw new TypeError('index is not defined');
  delete this._current.store.indexes[name];
  this._versions[this.version()].dropIndexes.push(index);
  return this;
};

/**
 * Generate onupgradeneeded callback.
 *
 * @return {Function}
 */

Schema.prototype.callback = function() {
  var versions = values(clone(this._versions))
    .sort(function(a, b) { return a.version - b.version });

  return function onupgradeneeded(e) {
    var oldVersion = e.oldVersion > MAX_VERSION ? 0 : e.oldVersion; // Safari bug
    var db = e.target.result;
    var tr = e.target.transaction;

    versions.forEach(function(versionSchema) {
      if (oldVersion >= versionSchema.version) return;

      versionSchema.stores.forEach(function(s) {
        db.createObjectStore(s.name, {
          keyPath: s.keyPath,
          autoIncrement: s.autoIncrement
        });
      });

      versionSchema.dropStores.forEach(function(s) {
        db.deleteObjectStore(s.name);
      });

      versionSchema.indexes.forEach(function(i) {
        var store = tr.objectStore(i.storeName);
        store.createIndex(i.name, i.field, {
          unique: i.unique,
          multiEntry: i.multiEntry
        });
      });

      versionSchema.dropIndexes.forEach(function(i) {
        var store = tr.objectStore(i.storeName);
        store.deleteIndex(i.name);
      });
    });
  };
};

/**
 * Get a description of the stores.
 * It creates a deep clone of `this._stores` object
 * and transform it to an array.
 *
 * @return {Array}
 */

Schema.prototype.stores = function() {
  return values(clone(this._stores)).map(function(store) {
    store.indexes = values(store.indexes).map(function(index) {
      delete index.storeName;
      return index;
    });
    return store;
  });
};

/**
 * Clone `this` to new schema object.
 *
 * @return {Schema}
 */

Schema.prototype.clone = function() {
  var schema = new Schema()
  Object.keys(this).forEach(function(key) {
    schema[key] = clone(this[key])
  }, this);
  return schema;
};
