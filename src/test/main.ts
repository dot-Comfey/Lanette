import fs = require('fs');
import fsPromises = require('fs/promises');
import Mocha = require('mocha');
import path = require('path');
import stream = require('stream');

import type { RunOptionNames, RunOptions } from '../types/root';
import { createTestRoom, testOptions } from './test-tools';

const modulesDir = path.join(__dirname, 'modules');
const moduleTests = fs.readdirSync(modulesDir).filter(x => x.endsWith('.js'));
const pokemonShowdownTestFile = 'pokemon-showdown.js';
const nonTrivialGameLoadTime = 200;

export async function initializeTests(inputOptions: RunOptions): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	const noOp = (): void => {};
	const methodsToNoOp = ['appendFile', 'chmod', 'rename', 'rmdir', 'symlink', 'unlink', 'watchFile', 'writeFile'];
	for (const method of methodsToNoOp) {
		// @ts-expect-error
		fs[method] = noOp;
		// @ts-expect-error
		fs[method + 'Sync'] = noOp;

		// @ts-expect-error
		fsPromises[method] = () => Promise.resolve();
	}

	Object.assign(fs, {createWriteStream() {
		return new stream.Writable();
	}});

	const keys = Object.keys(inputOptions) as RunOptionNames[];
	for (const key of keys) {
		testOptions[key] = inputOptions[key];
	}

	try {
		clearInterval(Storage.globalDatabaseExportInterval);

		// allow tests to assert on Client's outgoingMessageQueue
		// @ts-expect-error
		Client.websocket.ws = {};
		// @ts-expect-error
		Client.websocket.pauseOutgoingMessages();

		// @ts-expect-error
		Client.publicChatRooms = ['mocha'];

		const room = createTestRoom();

		if (!Config.allowScriptedGames) Config.allowScriptedGames = [];
		Config.allowScriptedGames.push(room.id);

		let modulesToTest: string[];
		if (testOptions.modules) {
			modulesToTest = testOptions.modules.split(',').map(x => x.trim() + '.js');
		} else {
			modulesToTest = moduleTests.concat(pokemonShowdownTestFile);
		}

		const loadGames = modulesToTest.includes('games.js');
		const loadWorkers = modulesToTest.includes('workers.js');

		if (testOptions.regression) {
			console.log("Loading dex data for tests...");
			for (let i = 1; i <= Dex.getGen(); i++) {
				Dex.getDex('gen' + i).getData();
			}
		}

		if (!loadGames && loadWorkers) {
			console.log("Loading worker data for tests...");
			const workers = Games.getWorkers();
			await workers.parameters.initializeThread();
			await workers.portmanteaus.initializeThread();
			console.log("Loaded worker data");
		}

		if (loadGames) {
			console.log("Loading game data for tests...");
			let formats: string[];
			if (testOptions.games) {
				formats = testOptions.games.split(',');
			} else if (testOptions.categories) {
				const categories = testOptions.categories.split(',').map(x => Tools.toId(x));
				formats = [];
				for (const i in Games.getFormats()) {
					const format = Games.getExistingFormat(i);
					if (format.category && categories.includes(Tools.toId(format.category))) {
						formats.push(i);
					}
				}
			} else {
				formats = Object.keys(Games.getFormats());
			}

			const unflaggedGames: string[] = [];
			for (const i of formats) {
				const format = Games.getExistingFormat(i);
				if (format.class.loadData) {
					const start = process.hrtime();
					await format.class.loadData(room);
					const end = process.hrtime(start);
					const loadTime = (end[0] * 1000000000 + end[1]) / 1000000;
					if (loadTime > nonTrivialGameLoadTime && !format.nonTrivialLoadData) {
						unflaggedGames.push("Format " + format.name + " should be flagged 'nonTrivialLoadData' (" +
							loadTime + "ms load time)");
					}
					format.class.loadedData = true;
				}
			}

			if (unflaggedGames.length) {
				for (const game of unflaggedGames) {
					console.log(game);
				}
				throw new Error("Missing 'nonTrivialLoadData' flag" + (unflaggedGames.length > 1 ? "s" : ""));
			}

			console.log("Loaded game data");
		}

		const mochaRunsOption = testOptions.mochaRuns ? parseInt(testOptions.mochaRuns) : 0;
		const maxMochaRuns = !isNaN(mochaRunsOption) ? Math.max(1, mochaRunsOption) : 1;

		const mochaOptions: Mocha.MochaInstanceOptions = {
			reporter: 'spec',
			ui: 'bdd',
		};

		if (testOptions.grep) mochaOptions.grep = testOptions.grep;

		const mocha = new Mocha(mochaOptions);

		if (modulesToTest.includes(pokemonShowdownTestFile)) mocha.addFile(path.join(__dirname, pokemonShowdownTestFile));

		for (const moduleTest of moduleTests) {
			if (modulesToTest.includes(moduleTest)) mocha.addFile(path.join(modulesDir, moduleTest));
		}

		let mochaRuns = 0;

		const runMocha = (): void => {
			mocha.run(failures => {
				void (async() => {
					if (failures) process.exit(1);

					mochaRuns++;
					if (mochaRuns === maxMochaRuns) {
						await Games.unrefWorkers();
						process.exit(failures ? 1 : 0);
					}

					mocha.unloadFiles();
					runMocha();
				})();
			});
		};

		runMocha();
	} catch (e) {
		console.log(e);
		Games.exitWorkers();
		process.exit(1);
	}
}
