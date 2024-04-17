import type { Player } from "../room-activity";
import { ScriptedGame } from "../room-game-scripted";
import type { GameCommandDefinitions, IGameFile } from "../types/games";
import type { IParam, IParametersThreadData } from './../workers/parameters';

const gameGen = 9;
const genString = 'gen' + gameGen;

type ParamType = 'color' | 'letter' | 'tier' | 'type';
const paramTypes: ParamType[] = ['color', 'letter', 'tier', 'type'];
const paramTypeDexesKeys: Dict<Dict<KeyedDict<ParamType, string[]>>> = {};

const searchTypes: (keyof IParametersThreadData)[] = ['pokemon'];

class InkaysCups extends ScriptedGame {
	answers: readonly string[] = [];
	canGrab: boolean = false;
	canLateJoin: boolean = true;
	points = new Map<Player, number>();
	roundGuesses = new Map<Player, boolean>();
	roundTime: number = 15 * 1000;
	usesWorkers: boolean = true;

	static async loadData(): Promise<void> {
		await Games.getWorkers().parameters.initializeThread();
		const parametersData = Games.getWorkers().parameters.getThreadData();

		for (const searchType of searchTypes) {
			paramTypeDexesKeys[searchType] = {};
			for (const gen in parametersData[searchType].gens) {
				paramTypeDexesKeys[searchType][gen] = {
					'color': [],
					'letter': [],
					'tier': [],
					'type': [],
				};
				for (const paramType of paramTypes) {
					paramTypeDexesKeys[searchType][gen][paramType] =
						Object.keys(parametersData[searchType].gens[gen].paramTypeDexes[paramType]);
				}
			}
		}
	}

	async onSignups(): Promise<void> { // eslint-disable-line @typescript-eslint/require-await
		if (this.options.freejoin && !this.isMiniGame) {
			this.setTimeout(() => void this.nextRound(), 5000);
		}
	}

	async onStart(): Promise<void> { // eslint-disable-line @typescript-eslint/require-await
		const text = "The game will be played in Gen " + gameGen + " (use ``/nds``)!";
		this.on(text, () => {
			this.setTimeout(() => void this.nextRound(), 5000);
		});
		this.say(text);
	}

	generateCups(): void {
		const workers = Games.getWorkers();
		const roundParamTypes = this.sampleMany(paramTypes, 2);
		const lower = this.options.freejoin ? 5 : this.getRemainingPlayerCount();
		const upper = lower * 3;
		let attempts = 0;
		let len = 0;
		let params: IParam[] = [];
		let mons: string[] = [];
		while ((len < lower || len > upper) && attempts < 10) {
			params = [];
			attempts++;
			for (const paramType of roundParamTypes) {
				const name = this.sampleOne(paramTypeDexesKeys.pokemon[genString][paramType]);
				params.push(workers.parameters.getThreadData().pokemon.gens[genString].paramTypePools[paramType][Tools.toId(name)]);
			}

			const intersection = workers.parameters.intersect({
				mod: genString,
				params,
				paramTypes,
				searchType: 'pokemon',
			});

			if (intersection === null) {
				this.say("An error occurred while generating parameters.");
				this.deallocate(true);
				return;
			}

			mons = intersection.pokemon;
			len = mons.length;
		}
		if (len < lower || len > upper) {
			this.generateCups();
			return;
		}
		this.answers = mons;
		this.roundGuesses.clear();

		const paramNames: string[] = params.map(x => x.param);
		for (let i = 0; i < params.length; i++) {
			if (params[i].type === 'letter') {
				paramNames[i] = "Starts with " + paramNames[i];
			} else if (params[i].type === 'type') {
				paramNames[i] += " type";
			}
		}

		const text = "Grab a Pokemon that fits the parameters: **" + Tools.joinList(paramNames) + "**!";
		this.on(text, () => {
			this.canGrab = true;
			if (this.parentGame && this.parentGame.onChildHint) this.parentGame.onChildHint(Tools.joinList(paramNames), this.answers, true);

			this.setTimeout(() => void this.nextRound(), this.getRoundTime());
		});
		this.say(text);
	}

	async onNextRound(): Promise<void> { // eslint-disable-line @typescript-eslint/require-await
		if (this.canLateJoin && this.round > 1) this.canLateJoin = false;
		this.canGrab = false;

		if (!this.options.freejoin) {
			if (this.round > 1) {
				if (this.roundTime > 5000) this.roundTime -= 2500;
				for (const i in this.players) {
					if (this.players[i].eliminated) continue;
					if (!this.roundGuesses.has(this.players[i])) this.eliminatePlayer(this.players[i], "You did not grab a Pokemon!");
				}
			}
			if (this.getRemainingPlayerCount() < 2) return this.end();
		}

		const html = this.getRoundHtml(players => this.options.freejoin ? this.getPlayerPoints(players) :
			this.getPlayerNames(players));
		const uhtmlName = this.uhtmlBaseName + '-round';
		this.onUhtml(uhtmlName, html, () => {
			if (this.timeout) clearTimeout(this.timeout);
			this.setTimeout(() => this.generateCups(), 5000);
		});
		this.sayUhtml(uhtmlName, html);
	}

	onEnd(): void {
		if (this.options.freejoin) {
			this.convertPointsToBits();
		} else {
			for (const i in this.players) {
				if (this.players[i].eliminated) continue;
				const player = this.players[i];
				this.winners.set(player, 1);
				this.addBits(player, 500);
			}
		}

		this.announceWinners();
	}

	getAnswers(givenAnswer: string): string {
		if (!givenAnswer) givenAnswer = Dex.getExistingPokemon(this.answers[0]).name;
		return "A possible answer was __" + givenAnswer + "__.";
	}

	botChallengeTurn(botPlayer: Player, newAnswer: boolean): void {
		if (!newAnswer) return;

		this.setBotTurnTimeout(() => {
			const command = "grab";
			const answer = this.sampleOne(this.answers).toLowerCase();
			const text = Config.commandCharacter + command + " " + answer;
			this.on(text, () => {
				botPlayer.useCommand(command, answer);
			});
			this.say(text);
		}, this.sampleOne(this.botChallengeSpeeds!));
	}
}

const commands: GameCommandDefinitions<InkaysCups> = {
	grab: {
		command(target, room, user) {
			if (!this.canGrab || this.roundGuesses.has(this.players[user.id])) return false;
			const player = this.createPlayer(user) || this.players[user.id];
			const guess = Tools.toId(target);
			if (!guess) return false;

			const guessMega = guess.substr(0, 4) === 'mega' ? guess.substr(4) + 'mega' : '';
			const guessPrimal = guess.substr(0, 6) === 'primal' ? guess.substr(6) + 'primal' : '';
			let answerIndex = -1;
			for (let i = 0; i < this.answers.length; i++) {
				const answer = Tools.toId(this.answers[i]);
				if (answer === guess || (guessMega && answer === guessMega) || (guessPrimal && answer === guessPrimal)) {
					answerIndex = i;
					break;
				}
			}
			if (answerIndex === -1) return false;

			if (this.botTurnTimeout) clearTimeout(this.botTurnTimeout);

			const answer = Dex.getExistingPokemon(this.answers[answerIndex]).name;
			if (this.options.freejoin) {
				let points = this.points.get(player) || 0;
				points++;
				this.points.set(player, points);
				this.say("**" + player.name + "** advances to **" + points + "** point" + (points > 1 ? "s" : "") + "! " +
						this.getAnswers(answer));
				if (points === this.options.points) {
					for (const i in this.players) {
						if (this.players[i] !== player) this.players[i].eliminated = true;
					}
					this.winners.set(player, points);
					this.end();
					return true;
				}
				void this.nextRound();
			} else {
				const answers = this.answers.slice();
				answers.splice(answerIndex, 1);
				this.answers = answers;
				this.roundGuesses.set(player, true);
				user.say("You grabbed " + answer + " and advanced to the next round!");
			}

			return true;
		},
	},
};

export const game: IGameFile<InkaysCups> = {
	aliases: ['inkays', 'cups'],
	challengeSettings: {
		botchallenge: {
			enabled: true,
			options: ['speed'],
			requiredFreejoin: true,
		},
		onevsone: {
			enabled: true,
			options: ['speed'],
			requiredFreejoin: true,
		},
	},
	category: 'knowledge-3',
	class: InkaysCups,
	commandDescriptions: [Config.commandCharacter + 'grab [Pokemon]'],
	commands,
	defaultOptions: ['freejoin', 'points'],
	description: "Players grab Pokemon that fit the given parameters each round (one per player)!",
	name: "Inkay's Cups",
	mascot: "Inkay",
	nonTrivialLoadData: true,
};
