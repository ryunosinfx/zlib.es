import '../../node_modules/mocha/mocha.js';
mocha.setup({
	ui: 'bdd',
	checkLeaks: true,
	asyncOnly: true,
	// reporter: 'spec',
});
const data = { len: 8589934592, max: 8589934592 };
try {
	for (let i = 0; i < data.len; i++) {
		const charenge = data.max + i;
		console.log('charenge:' + charenge + '/' + i);
		new Uint8Array(charenge);
	}
} catch (e) {
	console.error(e);
}
//33554432
//17414258688
//1073741824
//8589934592
// import './code-path-test.test.js';
// import './gunzip-test.js';
// import './gzip-test.js';
// import './inflate-test.js';
// import './raw-inflate-test.js';
// mocha.checkLeaks();
// mocha.run();
