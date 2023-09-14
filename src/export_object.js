import { Zlib } from './zlib.js';
Zlib.exportObject = function (enumString, exportKeyValue) {
	for (const key in exportKeyValue) {
		goog.exportSymbol(enumString + '.' + key, exportKeyValue[key]);
	}
};
