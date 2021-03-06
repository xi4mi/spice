'use strict';

const url = require('url');
const notify = require('../connect/notify');

module.exports = function*(next) {
	notify.test(this.parsedUrl.href);
	yield next;
};
