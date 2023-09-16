import mocha from '../../node_modules/mocha/mocha.js';
mocha.setup('bdd');
import './code-path-test.js';
import './gunzip-test.js';
import './gzip-test.js';
import './inflate-test.js';
import './raw-inflate-test.js';
