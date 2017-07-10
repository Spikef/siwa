var yaml = require('js-yaml');
var utils = require('./lib/utils');
var dataTypes = utils.dataTypes;

function Siwa(spec) {
    if (!this instanceof Siwa) {
        return new Siwa(spec);
    }

    this.spec = this.resolve(spec);
}

Siwa.prototype.resolve = function(spec) {
    var result = null;
    var type = utils.getType(spec);

    switch (type) {
        case dataTypes.OBJECT:
            result = JSON.parse(JSON.stringify(spec));
            break;
        case dataTypes.STRING:
            try {
                result = yaml.safeLoad(spec);
            } catch(e) {
                console.error(e);
            }

            break;
    }

    if (result && result.definitions) {
        var definitions = {};
        for (var i in result.definitions) {
            if (!result.definitions.hasOwnProperty(i)) continue;
            let defer = this.defer(result.definitions, i);
            if (defer) definitions[i] = JSON.parse(defer);
        }
        result.definitions = definitions;
    }

    return result;
};

Siwa.prototype.parse = function() {
    var spec = this.spec;

    if (!spec || spec.swagger !== '2.0') {
        throw new Error('Swagger specification error!');
    }

    if (!spec.paths) {
        throw new Error('Paths is required for the specification!');
    }

    Object.keys(spec.paths).forEach(path => {
        let operations = spec.paths[path];

        if (operations.$ref) {
            let schema = this.getRef(operations.$ref);
            if (schema) {
                spec.paths[path] = schema;
                operations = schema;
            } else {
                console.log(`Unknown path: ${path}`);
                delete spec.paths[path];
                return;
            }
        }

        // method can be: get, post, put, delete, patch, head, options
        Object.keys(operations).forEach(method => {
            let isUnknown = !/^get|delete|head|options|post|put|patch$/.test(method);
            if (isUnknown) return;

            let operation = operations[method];

            // 请求发送参数
            let parameters = [];
            operation.parameters = operation.parameters || operations.parameters || spec.parameters || [];
            if (utils.isType(operation.parameters, dataTypes.OBJECT)) {
                for (let name in operation.parameters) {
                    if (!operation.parameters.hasOwnProperty(name)) continue;

                    let p = Object.assign({
                        name: name
                    }, operation.parameters[name]);

                    p = this.lookup(p);

                    if (p) parameters.push(p);
                }
            } else if (utils.isType(operation.parameters, dataTypes.ARRAY)) {
                for (let i=0; i<operation.parameters.length; i++) {
                    let p = operation.parameters[i];

                    p = this.lookup(p);
                    if (p) parameters.push(p);
                }
            }
            operation.parameters = parameters;

            // 响应返回参数
            let responses = {};
            operation.responses = operation.responses || operations.responses || spec.responses || {};
            if (utils.isType(operation.responses, dataTypes.OBJECT)) {
                for (let name in operation.responses) {
                    if (!operation.responses.hasOwnProperty(name)) continue;

                    let p = Object.assign({
                        name: name
                    }, operation.responses[name]);

                    p = this.lookup(p);
                    if (p) responses[name] = p;
                }
            }

            operation.responses = responses;
        });
    });

    return spec;
};

Siwa.prototype.lookup = function(p) {
    if (!utils.isType(p, dataTypes.OBJECT)) {
        console.log(`Unknown: `, p);
        return null;
    }

    let $ref = p.schema ? p.schema.$ref : p.$ref;
    if ($ref) {
        if ($ref.nested) return $ref;

        let def = this.getRef($ref);

        if (!def) {
            console.log(`Unknown $ref: ${$ref}`);
            return null;
        }

        delete p.$ref;
        p.schema = def;
    }

    if (p.schema) {
        if (utils.isType(p.schema.required, dataTypes.ARRAY)) {
            p.schema.requireds = p.schema.required;
            delete p.schema.required;
        }

        p = Object.assign(p, p.schema);
        delete p.schema;
    }

    if (utils.isType(p.required, dataTypes.ARRAY)) {
        p.requireds = p.required;
        delete p.required;
    }

    if (p.items) {
        p.type = 'array';
        p.children = [];

        let item = this.lookup(p.items);
        if (item) p.children.push(item);

        delete p.items;
    } else if (p.allOf) {
        p.type = 'array';
        p.children = [];

        p.allOf.forEach(item => {
            item = this.lookup(item);
            if (item) p.children.push(item);
        });

        delete p.allOf;
    } else if (p.properties) {
        p.type = 'object';
        p.children = [];

        let requireds = p.requireds || [];
        for (let name in p.properties) {
            if (!p.properties.hasOwnProperty(name)) continue;

            let item = Object.assign({
                name: name,
            }, p.properties[name]);

            item = this.lookup(item);
            item.required = !!~requireds.indexOf(name);
            if (item) p.children.push(item);
        }

        delete p.requireds;
        delete p.properties;
    }

    // 归一化处理
    switch (p.type) {
        case 'integer':
            p.type = 'number';
            p.format = p.format || 'int64';
            break;
        case 'array':
        case 'object':
            p.children = p.children || [];
            break;
    }

    return p;
};

Siwa.prototype.compare = function(spec) {
    var spec1 = this.spec;
    var spec2 = this.resolve(spec);

    return JSON.stringify(spec1) === JSON.stringify(spec2);
};

Siwa.prototype.validate = function(data, path, key) {

};

Siwa.prototype._validate = function(data, define, path = [], result = {}) {

};

Siwa.prototype.getRef = function(ref) {
    if (!ref) return ref;

    if (!utils.isType(ref, dataTypes.STRING)) {
        return JSON.parse(JSON.stringify(ref));
    }

    let refs = ref.split('/');
    try {
        let ref = this.spec[refs[1]][refs[2]];
        return JSON.parse(JSON.stringify(ref));
    } catch(e) {
        return null;
    }
};

// 对于$ref嵌套$ref的情况, 可能会造成递归嵌套, 所以需要处理
// 因为需要递归调用, 所以最终返回字符串格式
Siwa.prototype.defer = function(definitions, key, stack = {}) {
    let ref = definitions[key];
    if (!ref) return null;
    stack = Object.assign({ [key]: true }, stack);
    ref = JSON.stringify(ref);
    ref = ref.replace(/"\$ref":"#\/definitions\/([^"]+)"(,?)/g, ($0, $1) => {
        if (stack[$1]) {
            return JSON.stringify({
                $ref: {
                    path: `#/definitions/${$1}`,
                    nested: true
                }
            }).replace(/^{|}$/g, '');
        } else {
            let ref = this.defer(definitions, $1, stack);
            if (ref) {
                return `"$ref":${ref}`;
            } else {
                return '';
            }
        }
    });
    ref = ref.replace(/",(?!")/g, '"');
    return ref;
};

Siwa.parse = function(spec) {
    var siwa = new Siwa(spec);
    return siwa.parse();
};

Siwa.compare = function(spec) {
    var siwa = require(spec);
    return siwa.compare(spec);
};

module.exports = Siwa;