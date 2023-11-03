class F {
	static async l(p, c = 'application/json', isText) {
		const q = {
			method: 'GET',
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'omit',
			redirect: 'follow',
			referrer: 'no-referrer',
			headers: { 'Content-Type': c },
		};
		const r = await fetch(p, q);
		return isText ? await r.text() : await r.blob();
	}
}

const N = '',
	wi = window;
export class Vw {
	static cnvtGebav2Camel(t = N) {
		if (!t) return t;
		const s = t.split('-');
		for (let i = 1, j = s.length; i < j; i++) {
			const w = s[i],
				l = w.length;
			s[i] = l > 0 ? w.substring(0, 1).toUpperCase() : `${l}` > 1 ? w.substring(1) : N;
		}
		return s.join(N);
	}
	static addHiddenDiv = (p, att = {}) => Vw.add(p, 'div', att, C.dNone);
	static add(p, tN, att = {}, sty = {}) {
		const e = Vw.ce(tN);
		Vw.sa(e, att);
		if (att.text) Vw.sT(e, att.text);
		Vw.sS(e, sty);
		if (p) p.appendChild(e);
		return e;
	}
	static d = document;
	static div = (p, att, sty) => Vw.add(p, 'div', att, sty);
	static h1 = (p, att, sty) => Vw.add(p, 'h1', att, sty);
	static h2 = (p, att, sty) => Vw.add(p, 'h2', att, sty);
	static btn = (p, att, sty) => Vw.add(p, 'button', att, sty);
	static ipt = (p, att, sty) => Vw.add(p, 'input', att, sty);
	static gi = (i) => Vw.d.getElementById(i);
	static rm = (e) => (e.parentNode ? e.parentNode.removeChild(e) : null);
	static rc = (e) => {
		while (e.firstChild) e.removeChild(e.firstChild);
	};
	static sS = (e, sty = {}) => Object.keys(sty).map((k) => (e.style[Vw.cnvtGebav2Camel(k)] = sty[k]));
	static sA = (e, k, v) => (e.style[Vw.cnvtGebav2Camel(k)] = v);
	static gS = (e, k) => e.style[Vw.cnvtGebav2Camel(k)];
	static tS = (e, k, v, v2) => (e.style[Vw.cnvtGebav2Camel(k)] = e.style[Vw.cnvtGebav2Camel(k)] === v ? v2 : v);
	static click = (e, cb) => Vw.ael(e, 'click', cb);
	static change = (e, cb) => Vw.ael(e, 'change', cb);
	static input = (e, cb) => Vw.ael(e, 'input', cb);
	static ael = (e, ev, cb) => (e.addEventListener(ev, cb) ? cb : cb);
	static rel = (e, ev, cb) => (e.removeEventListener(ev, cb) ? cb : cb);
	static sT = (e, msg) => (msg ? (e.textContent = msg) : e.textContent);
	static aC = (e, cN) => e.classList.add(cN);
	static rC = (e, cN) => e.classList.remove(cN);
	static tC = (e, cN) => e.classList.toggle(cN);
	static sa = (e, att) => Object.keys(att).map((k) => e.setAttribute(k, att[k]));
	static gB = () => Vw.d.getElementsByTagName('body')[0];
	static gT = (p, T) => p.getElementsByTagName(T)[0];
	static ce = (tN) => Vw.d.createElement(tN);
	static copy = async (d) => navigator.clipboard.writeText(d);
	static uO = (a, b) => {
		const c = {};
		for (const k in a) c[k] = a[k];
		for (const k in b) c[k] = b[k];
		return c;
	};
	static fr = (f) => {
		// io(f);
		const r = new FileReader(),
			p = pr((rv, rj) => {
				r.onload = () => rv(r.result);
				r.onerror = () => rj(r.error);
			});
		return {
			asArrayBuffer() {
				r.readAsArrayBuffer(f);
				return p;
			},
			asBinaryString() {
				r.readAsBinaryString(f);
				return p;
			},
			asDataURL() {
				r.readAsDataURL(f);
				return p;
			},
			asText() {
				r.readAsText(f);
				return p;
			},
		};
	};
	static beDraggable(e) {
		const p = 'px',
			T = 'top',
			L = 'left',
			a = (k) => Vw.gS(e, k).split(p).join(N) * 1,
			b = (k, x) => Vw.sA(e, k, x + p),
			m = {},
			f = (evt) => {
				st(() => {
					m.eX = evt.clientX;
					m.eY = evt.clientY;
					b(L, m.x + m.eX - m.sX);
					b(T, m.y + m.eY - m.sY);
				}, 1);
			};
		Vw.ael(e, 'mousedown', async (evt) => {
			Vw.sA(e, 'cursor', 'grab');
			m.x = a(L);
			m.y = a(T);
			m.sX = evt.clientX;
			m.sY = evt.clientY;
			Vw.ael(wi, 'mousemove', f);
		});
		Vw.ael(wi, 'mouseup', () => {
			Vw.sA(e, 'cursor', 'auto');
			Vw.rel(wi, 'mousemove', f);
		});
	}
}
const SLASH = '&#47;';
const HTTP_REGXP = /http:\/\//g;
const HTTPS_REGXP = /https:\/\//g;
const A = 'ACCESS_POINT';
const Q = 'QUERY';
export class Builder {
	static build(src) {
		const rows = src
			.split('\t')
			.join('')
			.replace(/\/\*[^\/]+\*\//g, '')
			.split('\n');
		const f = [];
		for (const r of rows) {
			const n = r.replace(HTTP_REGXP, 'http:' + SLASH + SLASH).replace(HTTPS_REGXP, 'https:' + SLASH + SLASH);
			f.push(
				n.split('//')[0].split(SLASH).join('/')
				// .replace(/^export /g, '')
			);
		}

		const b = f.join(' ');
		let l = b ? b + '' : '';
		const ks = ':;,-+=*><(){}?/'.split('');
		ks.push('!==');
		ks.push('||');
		ks.push('&&');
		for (const k of ks) {
			l = l
				.split(' ' + k)
				.join(k)
				.split(k + ' ')
				.join(k)
				.split(k + ' ' + k)
				.join(k + k);
		}
		for (const k of ks) {
			l = l
				.split(' ' + k)
				.join(k)
				.split(k + ' ')
				.join(k)
				.split(k + ' ' + k)
				.join(k + k);
		}
		console.log(l);
		const l2 = l.replace(/\/\*[^\/]+\*\//g, '');
		// return `javascript:(function(){${l};a()})()`;
		return l2;
	}
	static async getBookmarklet(jsPath, q, d = '/') {
		const c = location.protocol + '//' + location.host + d;
		const s = await F.l(`${jsPath}`, undefined, true);
		const b = s.split(A).join(c).split(Q).join(q);
		return Builder.build(b);
	}
}
const Target = '../src/zlib.es.js';
export class BK {
	static FirefoxMax = 62452;
	static async build() {
		const p = Vw.gi('main');
		const frame = Vw.div(p);
		const src = Vw.h2(frame, { text: 'Source of the builded' }, { margin: 0 });
		const textArea = Vw.div(frame);
		const ta = Vw.add(
			textArea,
			'textarea',
			{ className: 'aaa' },
			{ width: '90vw', height: '90vh', fontSize: '70%' }
		);
		const link = Vw.div(textArea);
		const a = Vw.add(link, 'a', { text: 'builded Link', href: location.href }, {});
		const s = Vw.add(link, 'span', {}, { display: 'inline-block', padding: '0 10px', fontSize: '80%' });
		Vw.ael(ta, 'input', BK.setLink(a, ta, s));
		const copy = Vw.add(link, 'button', { text: 'copy' });
		Vw.click(copy, () => {
			Vw.copy(ta.value);
			alert('copied!');
		});
		ta.value = await Builder.getBookmarklet(Target, '');
		console.log("await BookmarkletBuilder.getBookmarklet(, ''):" + (await Builder.getBookmarklet(Target, '')));
		BK.init(a, ta, s);
	}
	static init(aElm, inputElm, sElm) {
		Vw.sa(aElm, { href: inputElm.value });
		sElm.textContent =
			inputElm.value.length +
			'byte /FirefoxMax:' +
			BK.FirefoxMax +
			'byte /left size:' +
			(BK.FirefoxMax - inputElm.value.length) +
			'byte';
	}
	static setLink = (aElm, inputElm, sElm) => {
		return () => BK.init(aElm, inputElm, sElm);
	};
}
BK.build();
