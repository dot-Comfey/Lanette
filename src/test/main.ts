import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';

// tslint:disable-next-line no-empty
const noOp = () => {};
const methodsToNoOp = ['appendFile', 'chmod', 'rename', 'rmdir', 'symlink', 'unlink', 'watchFile', 'writeFile'];
for (let i = 0; i < methodsToNoOp.length; i++) {
	// @ts-ignore
	fs[methodsToNoOp[i]] = noOp;
	// @ts-ignore
	fs[methodsToNoOp[i] + 'Sync'] = noOp;
}

Object.assign(fs, {createWriteStream() {
	return new Writable();
}});

// tslint:disable-next-line no-var-requires
require("./../app.js");

const modulesDir = path.join(__dirname, 'modules');
const moduleTests = fs.readdirSync(modulesDir);
for (let i = 0; i < moduleTests.length; i++) {
	// tslint:disable-next-line no-var-requires
	require(path.join(modulesDir, moduleTests[i]));
}
