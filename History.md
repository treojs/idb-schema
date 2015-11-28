## 3.2.0 / 2015-11-28

* improve arguments validation and error messages
* minor improvements to docs and integration tests

## 3.1.1 / 2015-11-19

* compile with [add-module-exports](https://github.com/59naga/babel-plugin-add-module-exports) to provide ES6 modules and CommonJS support (related with [idb-range#2](https://github.com/treojs/idb-range/issues/2) and [treo#38](https://github.com/treojs/treo/pull/38))

## 3.1.0 / 2015-11-13

* use ES6's `isInteger` instead of `component-type`
* use `babel@6` for build
* use `zuul` to run CI tests in all supported browsers
* better docs

## 3.0.0 / 2015-11-03

* **breaking**: require keyPath when autoIncrement set to true
* **breaking**: disable constructor usage without `new`
* add support for IE10+
* module is written on ES6 and compiled with babel
* use eslint-config-airbnb as default linting strategy

## 2.1.0 / 2015-10-24

* add `schema.addCallback()` [@brettz9](https://github.com/brettz9)
* use eslint [@brettz9](https://github.com/brettz9)
* use treo-websql

## 2.0.0 / 2015-05-01

* **breaking**: remove legacy `dropStore` and `dropIndex`
* docs and code style improvements

## 1.1.0 / 2015-04-30

* add schema.clone()
* add support for [indexeddbshim](https://github.com/axemclion/IndexedDBShim)

## 1.0.0 / 2015-04-09

* extracted from [treo](http://treojs.com)
