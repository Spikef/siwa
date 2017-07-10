var fs = require('fs');
var path = require('path');
var Siwa = require('../src');
var data = fs.readFileSync(path.resolve(__dirname, 'data/online.json'), 'utf8');

var siwa = new Siwa(data);

var result = siwa.parse();

fs.writeFileSync(path.resolve(__dirname, 'result.json'), JSON.stringify(result, null, 4));