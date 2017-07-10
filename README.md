siwa

>

## Install

```bash
$ npm install siwa --save
```

## Basic Usage

```javascript
var spec = '{"swagger": "2.0"}';

var Siwa = require('siwa');
var siwa = new Siwa(spec);  // spec can be json object, stringify json or yaml string

console.log(siwa.parse());
```

## API

### parse

Parse the specification for further usage.

### compare(spec)

Compare two spec is the same.

### validate(data, path, method/response code)