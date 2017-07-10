/**
 * 枚举对象, 所有可能的数据类型
 */
exports.dataTypes = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    NULL: 'null',
    UNDEFINED: 'undefined',
    ARRAY: 'array',
    DATE: 'date',
    ERROR: 'error',
    FUNCTION: 'function',
    MATH: 'math',
    OBJECT: 'object',
    REGEXP: 'regexp',
    PROMISE: 'promise',
    SYMBOL: 'symbol',
    BUFFER: 'buffer',
};

/**
 * 获取对象类型
 * @param obj
 * @returns {string}
 */
exports.getType = function(obj) {
    var type = obj === null ? 'null' : typeof obj;
    if (type === 'object') {
        if (Buffer.isBuffer(obj)) {
            type = 'buffer';
        } else {
            type = Object.prototype.toString.call(obj); // [object Array];
            type = type.replace(/(\[object )|]/g, '').toLowerCase();
        }
    }

    return type;
};

exports.isType = function(obj, type) {
    return this.getType(obj) === type;
};