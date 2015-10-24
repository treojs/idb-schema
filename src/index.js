import type from 'component-type'
import clone from 'component-clone'
import values from 'object-values'

/**
 * Maximum version value (unsigned long long)
 * http://www.w3.org/TR/IndexedDB/#events
 */

const MAX_VERSION = Math.pow(2, 32) - 1

/**
 * Export `Schema`.
 */

export default class Schema {
  constructor() {
    this._stores = {}
    this._current = {}
    this._versions = {}
    this.version(1)
  }

  /**
   * Get/Set new version.
   *
   * @param {Number} [version]
   * @return {Schema|Number}
   */

  version(version) {
    if (!arguments.length) return this._current.version
    if (type(version) !== 'number'
    || version < 1
    || version < this.version()
    || version > MAX_VERSION) {
      throw new TypeError('not valid version')
    }

    this._current = { version: version, store: null }
    this._versions[version] = {
      stores: [],       // db.createObjectStore
      dropStores: [],   // db.deleteObjectStore
      indexes: [],      // store.createIndex
      dropIndexes: [],  // store.deleteIndex
      callbacks: [],
      version: version, // version
    }

    return this
  }

  /**
   * Add store.
   *
   * @param {String} name
   * @param {Object} [opts] { key: null, increment: false }
   * @return {Schema}
   */

  addStore(name, opts = {}) {
    if (type(name) !== 'string') throw new TypeError('`name` is required')
    if (this._stores[name]) throw new TypeError('store is already defined')

    const store = {
      name: name,
      indexes: {},
      keyPath: opts.key || opts.keyPath || null,
      autoIncrement: opts.increment || opts.autoIncrement || false,
    }
    if (store.autoIncrement && !store.keyPath) {
      throw new TypeError('set keyPath in order to use autoIncrement')
    }

    this._stores[name] = store
    this._versions[this.version()].stores.push(store)
    this._current.store = store

    return this
  }

  /**
   * Delete store.
   *
   * @param {String} name
   * @return {Schema}
   */

  delStore(name) {
    if (type(name) !== 'string') throw new TypeError('`name` is required')
    const store = this._stores[name]
    if (!store) throw new TypeError('store is not defined')
    delete this._stores[name]
    this._versions[this.version()].dropStores.push(store)
    this._current.store = null
    return this
  }

  /**
   * Change current store.
   *
   * @param {String} name
   * @return {Schema}
   */

  getStore(name) {
    if (type(name) !== 'string') throw new TypeError('`name` is required')
    if (!this._stores[name]) throw new TypeError('store is not defined')
    this._current.store = this._stores[name]
    return this
  }

  /**
   * Add index.
   *
   * @param {String} name
   * @param {String|Array} field
   * @param {Object} [opts] { unique: false, multi: false }
   * @return {Schema}
   */

  addIndex(name, field, opts = {}) {
    if (type(name) !== 'string') throw new TypeError('`name` is required')
    if (type(field) !== 'string' && type(field) !== 'array') {
      throw new TypeError('`field` is required')
    }
    const store = this._current.store
    if (store.indexes[name]) throw new TypeError('index is already defined')

    const index = {
      name: name,
      field: field,
      storeName: store.name,
      multiEntry: opts.multi || opts.multiEntry || false,
      unique: opts.unique || false,
    }
    store.indexes[name] = index
    this._versions[this.version()].indexes.push(index)

    return this
  }

  /**
   * Delete index.
   *
   * @param {String} name
   * @return {Schema}
   */

  delIndex(name) {
    if (type(name) !== 'string') throw new TypeError('`name` is required')
    const index = this._current.store.indexes[name]
    if (!index) throw new TypeError('index is not defined')
    delete this._current.store.indexes[name]
    this._versions[this.version()].dropIndexes.push(index)
    return this
  }

  /**
   * Add a callback to be executed at the end of the `upgradeneeded` event.
   * Callback will be supplied the `upgradeneeded` event object.
   *
   * @param {Function} cb
   * @return {Schema}
   */

  addCallback(cb) {
    this._versions[this.version()].callbacks.push(cb)
    return this
  }

  /**
   * Generate onupgradeneeded callback.
   *
   * @return {Function}
   */

  callback() {
    const versions = values(clone(this._versions)).sort((a, b) => a.version - b.version)
    return function onupgradeneeded(e) {
      const oldVersion = e.oldVersion > MAX_VERSION ? 0 : e.oldVersion // Safari bug
      const db = e.target.result
      const tr = e.target.transaction

      versions.forEach((versionSchema) => {
        if (oldVersion >= versionSchema.version) return

        versionSchema.stores.forEach((s) => {
          const opts = {}
          if (s.keyPath) opts.keyPath = s.keyPath
          if (s.autoIncrement) opts.autoIncrement = s.autoIncrement
          db.createObjectStore(s.name, opts)
        })

        versionSchema.dropStores.forEach((s) => {
          db.deleteObjectStore(s.name)
        })

        versionSchema.indexes.forEach((i) => {
          tr.objectStore(i.storeName).createIndex(i.name, i.field, {
            unique: i.unique,
            multiEntry: i.multiEntry,
          })
        })

        versionSchema.dropIndexes.forEach((i) => {
          tr.objectStore(i.storeName).deleteIndex(i.name)
        })

        versionSchema.callbacks.forEach((cb) => {
          cb(e)
        })
      })
    }
  }

  /**
   * Get a description of the stores.
   * It creates a deep clone of `this._stores` object
   * and transform it to an array.
   *
   * @return {Array}
   */

  stores() {
    return values(clone(this._stores)).map((store) => {
      store.indexes = values(store.indexes).map((index) => {
        delete index.storeName
        return index
      })
      return store
    })
  }

  /**
   * Clone `this` to new schema object.
   *
   * @return {Schema} - new object
   */

  clone() {
    const schema = new Schema()
    Object.keys(this).forEach((key) => schema[key] = clone(this[key]))
    return schema
  }
}
